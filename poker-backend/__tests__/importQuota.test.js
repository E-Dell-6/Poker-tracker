import { describe, it, expect, vi, beforeEach } from 'vitest';

// Signup is public, so these limits are the difference between a bulk
// import feature and an open invitation to fill the disk. Each test pins
// one boundary and checks the refusal explains itself - a refused import is
// something the UI has to be able to tell the user about.

const mockImportJob = { countDocuments: vi.fn(), find: vi.fn(), updateMany: vi.fn() };
const mockUser = { findById: vi.fn() };
vi.mock('../model/ImportJob.js', () => ({ default: mockImportJob }));
vi.mock('../model/User.js', () => ({ default: mockUser }));

const { checkImportQuota, checkJobCapacity } = await import('../services/importQuota.js');
const { QUOTA, UPLOAD } = await import('../config/limits.js');

const MB = 1024 * 1024;

function stubRecentJobs(jobs) {
  mockImportJob.find.mockReturnValue({ select: () => ({ lean: async () => jobs }) });
}
function stubUser(user) {
  mockUser.findById.mockReturnValue({ select: () => ({ lean: async () => user }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockImportJob.countDocuments.mockResolvedValue(0);
  mockImportJob.updateMany.mockResolvedValue({ modifiedCount: 0 });
  stubRecentJobs([]);
  stubUser({ storageBytes: 0, totalHands: 0 });
});

describe('checkImportQuota', () => {
  it('allows a first import on a fresh account', async () => {
    expect(await checkImportQuota('u1', 10 * MB)).toEqual({ ok: true });
  });

  it('refuses a second concurrent import', async () => {
    mockImportJob.countDocuments.mockResolvedValue(QUOTA.CONCURRENT_JOBS);
    const result = await checkImportQuota('u1', 1);
    expect(result.error).toMatch(/already have an import in progress/i);
  });

  it('only counts a staging job as active while it is recent', async () => {
    // Staging is client-driven, so a closed tab leaves one behind. Counting
    // those forever would lock the user out of importing with no recourse -
    // the bug this guards against was reachable by a single rejected file.
    await checkImportQuota('u1', 1);
    const [filter] = mockImportJob.countDocuments.mock.calls[0];
    const stagingClause = filter.$or.find(c => c.status === 'staging');

    expect(stagingClause.createdAt.$gte).toBeInstanceOf(Date);
    // queued/running have no such window - they're active regardless of age.
    const activeClause = filter.$or.find(c => Array.isArray(c.status?.$in));
    expect(activeClause.status.$in).toEqual(['queued', 'running']);
  });

  it('retires abandoned staging jobs so they stop blocking imports', async () => {
    await checkImportQuota('u1', 1);
    expect(mockImportJob.updateMany).toHaveBeenCalledTimes(1);
    const [filter, update] = mockImportJob.updateMany.mock.calls[0];
    expect(filter.status).toBe('staging');
    expect(filter.createdAt.$lt).toBeInstanceOf(Date);
    expect(update.$set.status).toBe('cancelled');
  });

  it('refuses once the daily job count is reached', async () => {
    stubRecentJobs(Array.from({ length: QUOTA.JOBS_PER_DAY }, () => ({ totalBytes: 1 })));
    const result = await checkImportQuota('u1', 1);
    expect(result.error).toMatch(/Daily import limit/i);
  });

  it('allows the last import within the daily job count', async () => {
    stubRecentJobs(Array.from({ length: QUOTA.JOBS_PER_DAY - 1 }, () => ({ totalBytes: 1 })));
    expect(await checkImportQuota('u1', 1)).toEqual({ ok: true });
  });

  it('counts the incoming request against the daily byte budget, not just what is already stored', async () => {
    // Just under the cap already; this request is what crosses it.
    stubRecentJobs([{ totalBytes: QUOTA.BYTES_PER_DAY - MB }]);
    const result = await checkImportQuota('u1', 2 * MB);
    expect(result.error).toMatch(/Daily upload limit/i);
  });

  it('allows a request that exactly reaches the daily byte budget', async () => {
    stubRecentJobs([{ totalBytes: QUOTA.BYTES_PER_DAY - MB }]);
    expect(await checkImportQuota('u1', MB)).toEqual({ ok: true });
  });

  it('refuses when stored bytes have hit the storage cap', async () => {
    stubUser({ storageBytes: QUOTA.TOTAL_BYTES_STORED, totalHands: 0 });
    const result = await checkImportQuota('u1', 1);
    expect(result.error).toMatch(/storage limit/i);
  });

  it('refuses when the stored hand count has hit its cap', async () => {
    stubUser({ storageBytes: 0, totalHands: QUOTA.TOTAL_HANDS_STORED });
    const result = await checkImportQuota('u1', 1);
    expect(result.error).toMatch(/hand limit/i);
  });

  it('tolerates a missing user document rather than throwing', async () => {
    stubUser(null);
    expect(await checkImportQuota('u1', 1)).toEqual({ ok: true });
  });

  it('treats absent counters on an older account as zero', async () => {
    stubUser({});
    expect(await checkImportQuota('u1', 1)).toEqual({ ok: true });
  });
});

describe('checkJobCapacity', () => {
  it('accepts a batch that fits', () => {
    expect(checkJobCapacity({ totalFiles: 10, totalBytes: MB }, 5, MB)).toBeNull();
  });

  it('rejects a batch that would exceed the per-job file count', () => {
    const job = { totalFiles: UPLOAD.FILES_PER_JOB, totalBytes: 0 };
    expect(checkJobCapacity(job, 1, 1)).toMatch(new RegExp(`${UPLOAD.FILES_PER_JOB} files`));
  });

  it('accepts a batch landing exactly on the file limit', () => {
    const job = { totalFiles: UPLOAD.FILES_PER_JOB - 1, totalBytes: 0 };
    expect(checkJobCapacity(job, 1, 1)).toBeNull();
  });

  it('rejects a batch that would exceed the per-job byte total', () => {
    const job = { totalFiles: 0, totalBytes: UPLOAD.BYTES_PER_JOB };
    expect(checkJobCapacity(job, 1, 1)).toMatch(/MB/);
  });

  it('treats a brand-new job with no counters as empty', () => {
    expect(checkJobCapacity({}, 1, 1)).toBeNull();
  });
});
