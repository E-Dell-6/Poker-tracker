import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Logging out of a stateless JWT.
//
// Clearing the cookie only asks a cooperating browser to stop sending the
// token. It says nothing about a copy held anywhere else, and the token
// stays cryptographically valid for the rest of its 7 days. What's pinned
// here is the round trip that makes logout real: the controller records
// the token's jti, and userAuth refuses it afterwards.
//
// The denylist is backed by a plain Set rather than assertion-counting on
// a mock, so a token genuinely has to come back out of the store that
// logout put it into - a test that only checked "updateOne was called"
// would still pass if userAuth never looked.

process.env.JWT_SECRET = 'test-secret-for-session-revocation';

const revoked = new Set();

const mockRevokedToken = {
  updateOne: vi.fn(async (filter, update, options) => {
    const jti = filter?.jti ?? update?.$setOnInsert?.jti;
    if (options?.upsert && jti) revoked.add(jti);
    return { acknowledged: true };
  }),
  exists: vi.fn(async ({ jti }) => (revoked.has(jti) ? { _id: 'x' } : null)),
};
vi.mock('../model/RevokedToken.js', () => ({ default: mockRevokedToken }));

// authController pulls in the mailer and the user model at import time;
// neither is exercised by the logout path, so they're stubbed to keep this
// test from needing SMTP config or a database.
vi.mock('../config/nodeMailer.js', () => ({ default: () => ({ sendMail: vi.fn() }) }));
vi.mock('../model/User.js', () => ({ default: { findOne: vi.fn(), findById: vi.fn() } }));

const { logout } = await import('../controllers/authController.js');
const { default: userAuth } = await import('../middleware/userAuth.js');

function mockRes() {
  const res = { statusCode: 200, body: null, cleared: [] };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.body = body; return res; });
  res.clearCookie = vi.fn((name) => { res.cleared.push(name); return res; });
  return res;
}

const signToken = (payload, opts = { expiresIn: '7d' }) =>
  jwt.sign(payload, process.env.JWT_SECRET, opts);

const validToken = (jti = 'jti-1') => signToken({ id: 'user-1', jti });

beforeEach(() => {
  revoked.clear();
  vi.clearAllMocks();
});

describe('logout revokes the session server-side', () => {
  it('accepts a freshly issued token', async () => {
    const req = { cookies: { token: validToken() }, body: {} };
    const res = mockRes();
    const next = vi.fn();

    await userAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-1');
  });

  it('refuses that same token once it has been logged out', async () => {
    const token = validToken();

    // The token works before logout...
    const before = { cookies: { token }, body: {} };
    const beforeNext = vi.fn();
    await userAuth(before, mockRes(), beforeNext);
    expect(beforeNext).toHaveBeenCalled();

    await logout({ cookies: { token } }, mockRes());

    // ...and is dead after it, without the cookie having to be absent -
    // this is exactly the stolen-copy case, where the holder still sends it.
    const after = { cookies: { token }, body: {} };
    const afterNext = vi.fn();
    const afterRes = mockRes();
    await userAuth(after, afterRes, afterNext);

    expect(afterNext).not.toHaveBeenCalled();
    expect(afterRes.statusCode).toBe(401);
  });

  it('revokes only the token logged out, leaving other sessions alive', async () => {
    const phone = validToken('jti-phone');
    const laptop = validToken('jti-laptop');

    await logout({ cookies: { token: phone } }, mockRes());

    const req = { cookies: { token: laptop }, body: {} };
    const next = vi.fn();
    await userAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('clears the cookie even when the revocation write fails', async () => {
    mockRevokedToken.updateOne.mockRejectedValueOnce(new Error('mongo down'));
    const res = mockRes();

    await logout({ cookies: { token: validToken() } }, res);

    // The device in front of the user must log out regardless.
    expect(res.cleared).toContain('token');
  });

  it('does not throw on a malformed or expired token', async () => {
    const res = mockRes();
    await logout({ cookies: { token: 'not-a-jwt' } }, res);
    expect(res.cleared).toContain('token');
    expect(res.statusCode).toBe(200);

    const expired = signToken({ id: 'user-1', jti: 'old' }, { expiresIn: -60 });
    const res2 = mockRes();
    await logout({ cookies: { token: expired } }, res2);
    expect(res2.statusCode).toBe(200);
  });

  it('stores the jti only until the token would have expired anyway', async () => {
    const token = validToken('jti-ttl');
    await logout({ cookies: { token } }, mockRes());

    const { $setOnInsert } = mockRevokedToken.updateOne.mock.calls[0][1];
    const exp = jwt.decode(token).exp * 1000;
    // Past its own exp the signature check rejects it for free, so holding
    // the row any longer is pure storage growth.
    expect($setOnInsert.expiresAt.getTime()).toBe(exp);
  });

  it('still accepts pre-upgrade tokens that carry no jti', async () => {
    // Issued before jti existed. These can't be revoked individually and
    // age out on their own; they must not lock their owner out meanwhile.
    const legacy = signToken({ id: 'user-legacy' });
    const req = { cookies: { token: legacy }, body: {} };
    const next = vi.fn();

    await userAuth(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-legacy');
  });
});
