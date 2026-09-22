import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// The typed-email confirmation on the Settings page is friction, not a
// control - it never reaches the server. This endpoint's password check is
// the only thing standing between a borrowed session and an irreversible
// wipe, so it has to hold on its own.

const mockUser = { findById: vi.fn() };
const mockSession = { countDocuments: vi.fn() };
const purgeAccount = vi.fn().mockResolvedValue();
const revokeCurrentToken = vi.fn().mockResolvedValue();
const clearSessionCookie = vi.fn();

vi.mock('../model/User.js', () => ({ default: mockUser }));
vi.mock('../model/Session.js', () => ({ default: mockSession }));
vi.mock('../services/accountService.js', () => ({ purgeAccount }));
vi.mock('../controllers/authController.js', () => ({ revokeCurrentToken, clearSessionCookie }));

const { deleteAccount } = await import('../controllers/userController.js');

const PASSWORD = 'correct-password-1';

function mockRes() {
  return { json: vi.fn(function (body) { this.body = body; return this; }) };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockUser.findById.mockReturnValue({
    select: async () => ({ _id: 'u1', password: await bcrypt.hash(PASSWORD, 10) }),
  });
  purgeAccount.mockResolvedValue();
  revokeCurrentToken.mockResolvedValue();
});

describe('deleteAccount', () => {
  it('wipes the account and kills the session when the password is right', async () => {
    const res = mockRes();
    await deleteAccount({ userId: 'u1', body: { password: PASSWORD } }, res);

    expect(res.body.success).toBe(true);
    expect(purgeAccount).toHaveBeenCalledWith('u1');
    // The account is gone, so the token naming it must not keep working.
    expect(revokeCurrentToken).toHaveBeenCalled();
    expect(clearSessionCookie).toHaveBeenCalledWith(res);
  });

  it('deletes nothing when the password is wrong', async () => {
    const res = mockRes();
    await deleteAccount({ userId: 'u1', body: { password: 'wrong-password' } }, res);

    expect(res.body).toEqual({ success: false, message: 'Password is incorrect' });
    expect(purgeAccount).not.toHaveBeenCalled();
    expect(clearSessionCookie).not.toHaveBeenCalled();
  });

  it('deletes nothing when no password is supplied at all', async () => {
    for (const body of [{}, { password: '' }, { password: '   ' }, { password: { $ne: null } }]) {
      const res = mockRes();
      await deleteAccount({ userId: 'u1', body }, res);
      expect(res.body.success).toBe(false);
    }
    expect(purgeAccount).not.toHaveBeenCalled();
  });

  it('reads req.userId, so req.body cannot name someone else account', async () => {
    const res = mockRes();
    await deleteAccount({ userId: 'u1', body: { userId: 'victim', password: PASSWORD } }, res);
    expect(purgeAccount).toHaveBeenCalledWith('u1');
  });

  it('refuses a request with no authenticated user', async () => {
    const res = mockRes();
    await deleteAccount({ body: { password: PASSWORD } }, res);
    expect(res.body).toEqual({ success: false, message: 'Not Authorized' });
    expect(purgeAccount).not.toHaveBeenCalled();
  });

  it('answers with a message instead of a rejected promise when the sweep fails', async () => {
    purgeAccount.mockRejectedValue(new Error('no primary'));
    const res = mockRes();
    await expect(deleteAccount({ userId: 'u1', body: { password: PASSWORD } }, res)).resolves.not.toThrow();
    expect(res.body.success).toBe(false);
    // The cookie survives a failed wipe, so the user can retry.
    expect(clearSessionCookie).not.toHaveBeenCalled();
  });
});
