import { describe, it, expect, vi, beforeEach } from 'vitest';

// GET /api/user/storage exists so the import quota stops being invisible:
// checkImportQuota refuses an import at TOTAL_BYTES_STORED / TOTAL_HANDS_STORED
// and tells the user to delete sessions, but until this endpoint there was no
// way to see how close they were. So what matters here is that it reports the
// same counters the quota check reads, and that it never leaks another user's.

const mockUser = { findById: vi.fn() };
const mockSession = { countDocuments: vi.fn() };
vi.mock('../model/User.js', () => ({ default: mockUser }));
vi.mock('../model/Session.js', () => ({ default: mockSession }));

const { getStorageUsage } = await import('../controllers/userController.js');
const { QUOTA } = await import('../config/limits.js');

function stubUser(user) {
  mockUser.findById.mockReturnValue({ select: () => ({ lean: async () => user }) });
}

// Minimal express double - these handlers only ever call res.json().
function mockRes() {
  return { json: vi.fn(function (body) { this.body = body; return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  stubUser({ storageBytes: 1024, totalHands: 40 });
  mockSession.countDocuments.mockResolvedValue(3);
});

describe('getStorageUsage', () => {
  it('reports the stored counters alongside the limits they are checked against', async () => {
    const res = mockRes();
    await getStorageUsage({ userId: 'u1' }, res);

    expect(res.body).toEqual({
      success: true,
      storage: {
        bytesUsed: 1024,
        bytesLimit: QUOTA.TOTAL_BYTES_STORED,
        handsUsed: 40,
        handsLimit: QUOTA.TOTAL_HANDS_STORED,
        sessionCount: 3,
      },
    });
  });

  it('scopes both reads to the authenticated user', async () => {
    await getStorageUsage({ userId: 'u1' }, mockRes());
    expect(mockUser.findById).toHaveBeenCalledWith('u1');
    expect(mockSession.countDocuments).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('reads req.userId, not req.body.userId', async () => {
    // userAuth sets both, but multer overwrites req.body on multipart routes -
    // req.userId is the one that survives. A handler reading the wrong one
    // would report someone else's usage if req.body were ever attacker-shaped.
    const res = mockRes();
    await getStorageUsage({ body: { userId: 'attacker' }, userId: 'u1' }, res);
    expect(mockUser.findById).toHaveBeenCalledWith('u1');
    expect(res.body.success).toBe(true);
  });

  it('refuses a request with no authenticated user', async () => {
    for (const req of [{}, { userId: '' }, { userId: '   ' }, { userId: 123 }]) {
      const res = mockRes();
      await getStorageUsage(req, res);
      expect(res.body).toEqual({ success: false, message: 'Not Authorized' });
    }
    expect(mockUser.findById).not.toHaveBeenCalled();
  });

  it('reports a missing user rather than throwing', async () => {
    stubUser(null);
    const res = mockRes();
    await getStorageUsage({ userId: 'gone' }, res);
    expect(res.body).toEqual({ success: false, message: 'User not Found' });
  });

  it('reads zero for an account that has never imported', async () => {
    // The counters default to 0 in the schema, but documents predating them
    // have no such field at all - the || 0 keeps that out of the response.
    stubUser({});
    mockSession.countDocuments.mockResolvedValue(0);
    const res = mockRes();
    await getStorageUsage({ userId: 'u1' }, res);
    expect(res.body.storage.bytesUsed).toBe(0);
    expect(res.body.storage.handsUsed).toBe(0);
  });

  it('answers with a message instead of a rejected promise when Mongo fails', async () => {
    mockSession.countDocuments.mockRejectedValue(new Error('no primary'));
    const res = mockRes();
    await expect(getStorageUsage({ userId: 'u1' }, res)).resolves.not.toThrow();
    expect(res.body.success).toBe(false);
  });
});
