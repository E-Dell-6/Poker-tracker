import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// config/limits.js resolves STAGING.DIR from IMPORT_STAGING_DIR at module
// load, and vitest does not load .env - so without this the middleware
// would try to mkdir the production default (/var/lib/pokerflow) and get
// EACCES, which is a real 503 path but not the one under test here.
const TMP_STAGING = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-guard-'));
process.env.IMPORT_STAGING_DIR = TMP_STAGING;

// mongod shares this box's filesystem, and a full disk corrupts it - which
// is why importRunner refuses to start a job below MIN_FREE_DISK_BYTES.
// POST /api/upload used to buffer in memory and never touch the disk, so
// it had no such guard. Now that it stages up to 20x10MB per request onto
// that same filesystem, the absence of the check would be a way to fill
// the disk that deliberately bypasses the floor the import path enforces.

const assertDiskHeadroom = vi.fn();
vi.mock('../services/importRunner.js', () => ({ assertDiskHeadroom }));
vi.mock('../services/sessionService.js', () => ({}));
vi.mock('../services/sessionImportService.js', () => ({
  processUpload: vi.fn(),
  createLegacySessionViaUploadPath: vi.fn(),
}));

const { prepareCsvUpload } = await import('../controllers/sessionController.js');

function mockRes() {
  const res = { statusCode: 200, body: null, handlers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.on = (ev, fn) => { res.handlers[ev] = fn; return res; };
  return res;
}

beforeEach(() => { assertDiskHeadroom.mockReset(); });

describe('CSV upload disk guard', () => {
  it('refuses the upload when the box is low on disk, before creating anything', async () => {
    assertDiskHeadroom.mockRejectedValue(new Error('The server is low on disk space. Please try again later.'));
    const req = {}; const res = mockRes(); const next = vi.fn();

    await prepareCsvUpload(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/low on disk space/);
    // Nothing staged, so there is nothing to clean up.
    expect(req.csvStagingDir).toBeUndefined();
  });

  it('proceeds when there is headroom', async () => {
    assertDiskHeadroom.mockResolvedValue(undefined);
    const req = {}; const res = mockRes(); const next = vi.fn();

    await prepareCsvUpload(req, res, next);

    expect(assertDiskHeadroom).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.csvStagingDir).toContain('csv-');
    expect(req.csvStagingDir.startsWith(TMP_STAGING)).toBe(true);
    expect(fs.existsSync(req.csvStagingDir)).toBe(true);
  });

  it('checks the disk before staging, not after', async () => {
    // Order matters: creating the directory first and then refusing would
    // leak a directory per rejected request, on the disk that is already full.
    const order = [];
    assertDiskHeadroom.mockImplementation(async () => { order.push('check'); throw new Error('The server is low on disk space.'); });
    const req = {}; const res = mockRes();
    Object.defineProperty(req, 'csvStagingDir', {
      set() { order.push('stage'); }, get() { return undefined; }, configurable: true,
    });

    await prepareCsvUpload(req, res, vi.fn());

    expect(order).toEqual(['check']);
  });
});
