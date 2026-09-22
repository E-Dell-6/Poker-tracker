import { describe, it, expect, vi, beforeEach } from 'vitest';

// Account deletion sweeps nine collections, and the one that will silently
// miss is sharedHand: its userId is typed String where every other model uses
// ObjectId, so an ObjectId filter matches nothing and leaves public share
// links alive, still serving hands from an account that no longer exists.
// That is the specific regression these tests exist to prevent.

const mk = () => ({ deleteMany: vi.fn().mockResolvedValue({}) });
const mockSession = mk();
const mockLiveSession = mk();
const mockPeople = mk();
const mockPlayerStats = mk();
const mockHandLedger = mk();
const mockFavorite = mk();
const mockSharedHand = mk();
const mockImportJob = { ...mk(), find: vi.fn() };
const mockUser = { deleteOne: vi.fn().mockResolvedValue({}) };
const removeJobStagingDir = vi.fn().mockResolvedValue();

vi.mock('../model/User.js', () => ({ default: mockUser }));
vi.mock('../model/Session.js', () => ({ default: mockSession }));
vi.mock('../model/LiveSession.js', () => ({ default: mockLiveSession }));
vi.mock('../model/People.js', () => ({ default: mockPeople }));
vi.mock('../model/PlayerStats.js', () => ({ default: mockPlayerStats }));
vi.mock('../model/HandLedger.js', () => ({ default: mockHandLedger }));
vi.mock('../model/ImportJob.js', () => ({ default: mockImportJob }));
vi.mock('../model/favourites.js', () => ({ default: mockFavorite }));
vi.mock('../model/sharedHand.js', () => ({ default: mockSharedHand }));
vi.mock('../services/importRunner.js', () => ({ removeJobStagingDir }));

const { purgeAccount } = await import('../services/accountService.js');

const USER_ID = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of [mockSession, mockLiveSession, mockPeople, mockPlayerStats,
                   mockHandLedger, mockFavorite, mockSharedHand, mockImportJob]) {
    m.deleteMany.mockResolvedValue({});
  }
  mockImportJob.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  mockUser.deleteOne.mockResolvedValue({});
  removeJobStagingDir.mockResolvedValue();
});

describe('purgeAccount', () => {
  it('clears every collection that holds the user data', async () => {
    await purgeAccount(USER_ID);
    for (const m of [mockSession, mockLiveSession, mockPeople, mockPlayerStats,
                     mockHandLedger, mockFavorite, mockImportJob]) {
      expect(m.deleteMany).toHaveBeenCalledWith({ userId: USER_ID });
    }
    expect(mockSharedHand.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockUser.deleteOne).toHaveBeenCalledWith({ _id: USER_ID });
  });

  it('filters shared hands by a STRING userId, matching that model schema', async () => {
    // sharedHand.js types userId as String. Passing the ObjectId that every
    // other model wants matches zero documents here, with no error - the
    // links just quietly outlive the account.
    const objectIdLike = { toString: () => USER_ID };
    await purgeAccount(objectIdLike);

    const [filter] = mockSharedHand.deleteMany.mock.calls[0];
    expect(typeof filter.userId).toBe('string');
    expect(filter.userId).toBe(USER_ID);
  });

  it('removes staging directories before the jobs that name them', async () => {
    mockImportJob.find.mockReturnValue({
      select: () => ({ lean: async () => [{ _id: 'job-1' }, { _id: 'job-2' }] }),
    });
    const order = [];
    removeJobStagingDir.mockImplementation(async (id) => { order.push(`rm:${id}`); });
    mockImportJob.deleteMany.mockImplementation(async () => { order.push('deleteMany'); return {}; });

    await purgeAccount(USER_ID);

    // Deleting the job rows first would strand the directories on disk, and
    // the orphan sweep that would catch them only runs at boot.
    expect(order).toEqual(['rm:job-1', 'rm:job-2', 'deleteMany']);
  });

  it('deletes the user document last, so a partial failure is retryable', async () => {
    const order = [];
    mockSession.deleteMany.mockImplementation(async () => { order.push('sessions'); return {}; });
    mockUser.deleteOne.mockImplementation(async () => { order.push('user'); return {}; });

    await purgeAccount(USER_ID);
    expect(order).toEqual(['sessions', 'user']);
  });

  it('leaves the account intact when a sweep fails, rather than orphaning its rows', async () => {
    mockSession.deleteMany.mockRejectedValue(new Error('no primary'));
    await expect(purgeAccount(USER_ID)).rejects.toThrow('no primary');
    expect(mockUser.deleteOne).not.toHaveBeenCalled();
  });

  it('survives a staging directory that cannot be removed', async () => {
    // A missing or locked directory must not strand the account half-deleted.
    mockImportJob.find.mockReturnValue({
      select: () => ({ lean: async () => [{ _id: 'job-1' }] }),
    });
    removeJobStagingDir.mockRejectedValue(new Error('ENOENT'));

    await expect(purgeAccount(USER_ID)).resolves.not.toThrow();
    expect(mockUser.deleteOne).toHaveBeenCalled();
  });
});
