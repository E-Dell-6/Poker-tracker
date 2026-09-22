import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// An authenticated password change has one property that the logged-out reset
// flow doesn't: a session is already in flight. If the token that arrived on
// this request keeps working afterwards, then a stolen cookie survives the
// exact action taken to stop it - so the revoke-and-reissue below is the
// substance of this endpoint, not bookkeeping.

const mockUser = { findById: vi.fn() };
const mockRevokedToken = { updateOne: vi.fn() };
vi.mock('../model/User.js', () => ({ default: mockUser }));
vi.mock('../model/RevokedToken.js', () => ({ default: mockRevokedToken }));
vi.mock('../config/nodeMailer.js', () => ({ default: () => ({ sendMail: vi.fn() }) }));

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { changePassword, MIN_PASSWORD_LENGTH } = await import('../controllers/authController.js');
const jwt = (await import('jsonwebtoken')).default;

const CURRENT = 'current-password-1';
const VALID_NEW = 'a-new-password-1';

function mockRes() {
  return {
    body: undefined,
    cookies: {},
    json: vi.fn(function (body) { this.body = body; return this; }),
    cookie: vi.fn(function (name, value, opts) { this.cookies[name] = { value, opts }; return this; }),
  };
}

// A request carrying a real signed token, so the revocation path has a jti
// and an exp to work with.
function reqWith(body, { withToken = true } = {}) {
  const token = jwt.sign({ id: 'u1', jti: 'jti-abc' }, process.env.JWT_SECRET, { expiresIn: 3600 });
  return { body: { userId: 'u1', ...body }, cookies: withToken ? { token } : {} };
}

let saved;
beforeEach(async () => {
  vi.clearAllMocks();
  saved = { password: await bcrypt.hash(CURRENT, 10), _id: 'u1', save: vi.fn() };
  mockUser.findById.mockResolvedValue(saved);
  mockRevokedToken.updateOne.mockResolvedValue({});
});

describe('changePassword', () => {
  it('stores a bcrypt hash of the new password, never the password itself', async () => {
    const res = mockRes();
    await changePassword(reqWith({ currentPassword: CURRENT, newPassword: VALID_NEW }), res);

    expect(res.body.success).toBe(true);
    expect(saved.save).toHaveBeenCalled();
    expect(saved.password).not.toBe(VALID_NEW);
    expect(saved.password).toMatch(/^\$2[aby]\$10\$/);
    await expect(bcrypt.compare(VALID_NEW, saved.password)).resolves.toBe(true);
  });

  it('refuses the wrong current password and leaves the stored one alone', async () => {
    const before = saved.password;
    const res = mockRes();
    await changePassword(reqWith({ currentPassword: 'not-the-password', newPassword: VALID_NEW }), res);

    expect(res.body).toEqual({ success: false, message: 'Current password is incorrect' });
    expect(saved.save).not.toHaveBeenCalled();
    expect(saved.password).toBe(before);
  });

  it('enforces the same minimum length the server enforces everywhere else', async () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    const res = mockRes();
    await changePassword(reqWith({ currentPassword: CURRENT, newPassword: short }), res);

    expect(res.body).toEqual({
      success: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    expect(saved.save).not.toHaveBeenCalled();
  });

  it('refuses a "change" that sets the same password back', async () => {
    const res = mockRes();
    await changePassword(reqWith({ currentPassword: CURRENT, newPassword: CURRENT }), res);
    expect(res.body.success).toBe(false);
    expect(saved.save).not.toHaveBeenCalled();
  });

  it('revokes the token the request arrived on', async () => {
    const res = mockRes();
    await changePassword(reqWith({ currentPassword: CURRENT, newPassword: VALID_NEW }), res);

    expect(mockRevokedToken.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update, opts] = mockRevokedToken.updateOne.mock.calls[0];
    expect(filter).toEqual({ jti: 'jti-abc' });
    expect(update.$setOnInsert.jti).toBe('jti-abc');
    expect(update.$setOnInsert.expiresAt).toBeInstanceOf(Date);
    expect(opts).toEqual({ upsert: true });
  });

  it('issues a fresh token, so the user is not signed out of the device they just used', async () => {
    const res = mockRes();
    await changePassword(reqWith({ currentPassword: CURRENT, newPassword: VALID_NEW }), res);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    const { value, opts } = res.cookies.token;
    const decoded = jwt.verify(value, process.env.JWT_SECRET);
    expect(decoded.id).toBe('u1');
    // A new jti, or the cookie just handed back the credential we revoked.
    expect(decoded.jti).not.toBe('jti-abc');
    expect(opts).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none' });
  });

  it('rejects a missing or non-string field instead of querying', async () => {
    const bodies = [
      { currentPassword: CURRENT },
      { newPassword: VALID_NEW },
      { currentPassword: '', newPassword: VALID_NEW },
      { currentPassword: { $ne: null }, newPassword: VALID_NEW },
    ];
    for (const body of bodies) {
      const res = mockRes();
      await changePassword(reqWith(body), res);
      expect(res.body.success).toBe(false);
    }
    expect(mockUser.findById).not.toHaveBeenCalled();
  });

  it('gives the same answer for an unknown user as for a wrong password', async () => {
    // Otherwise the difference between the two says whether an id exists.
    mockUser.findById.mockResolvedValue(null);
    const res = mockRes();
    await changePassword(reqWith({ currentPassword: CURRENT, newPassword: VALID_NEW }), res);
    expect(res.body).toEqual({ success: false, message: 'Current password is incorrect' });
  });

  it('answers with a message instead of a rejected promise when Mongo fails', async () => {
    mockUser.findById.mockRejectedValue(new Error('no primary'));
    const res = mockRes();
    const req = reqWith({ currentPassword: CURRENT, newPassword: VALID_NEW });
    await expect(changePassword(req, res)).resolves.not.toThrow();
    expect(res.body.success).toBe(false);
  });
});
