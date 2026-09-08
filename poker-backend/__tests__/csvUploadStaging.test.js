import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// POST /api/upload used to run on multer's memoryStorage with
// `files: 20, fileSize: 10MB`, so one request could hold 200MB of request
// body in RSS before any parsing started - on a box the code's own comments
// describe as 1-2 cores with mongod co-resident. It now stages to disk.
//
// What's pinned here is the part that actually bounds memory: files are
// read one at a time and released as they go, so peak footprint is a
// single file rather than the whole batch. A test that only checked "the
// import succeeded" would pass just as well against the old buffered
// version.

const importOneFile = vi.fn();
vi.mock('../services/handImportPipeline.js', () => ({ importOneFile }));
vi.mock('../services/personResolver.js', () => ({ createPersonResolver: async () => ({}) }));
vi.mock('../services/statsService.js', () => ({ recomputeStatsForPersonIds: vi.fn(async () => {}) }));
vi.mock('../model/LiveSession.js', () => ({ default: {} }));

const { processUpload } = await import('../services/sessionImportService.js');

let dir;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'csv-staging-'));
  importOneFile.mockReset();
  importOneFile.mockResolvedValue({ success: true, filename: 'x', personIds: [], touchesHero: false });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function stage(name, contents) {
  const stored = path.join(dir, `${Math.random().toString(16).slice(2)}.csv`);
  await fs.writeFile(stored, contents);
  return { path: stored, originalname: name, size: Buffer.byteLength(contents) };
}

describe('CSV upload staging', () => {
  it('reads each staged file from disk and passes its contents through', async () => {
    const files = [await stage('a.csv', 'hand-one'), await stage('b.csv', 'hand-two')];

    await processUpload('user-1', files);

    expect(importOneFile).toHaveBeenCalledTimes(2);
    const seen = importOneFile.mock.calls.map(([arg]) => arg.buffer.toString());
    expect(seen).toEqual(['hand-one', 'hand-two']);
    // The client-supplied name is metadata only - it never became the path.
    expect(importOneFile.mock.calls.map(([a]) => a.filename)).toEqual(['a.csv', 'b.csv']);
  });

  it('never holds more than one file in memory at a time', async () => {
    const files = [];
    for (let i = 0; i < 5; i++) files.push(await stage(`f${i}.csv`, `contents-${i}`));

    // At the moment file N is handed to the pipeline, every earlier file
    // must already be off disk - which is only possible if they were read
    // and released one at a time rather than buffered up front.
    const remainingWhenCalled = [];
    importOneFile.mockImplementation(async () => {
      remainingWhenCalled.push((await fs.readdir(dir)).length);
      return { success: true, personIds: [], touchesHero: false };
    });

    await processUpload('user-1', files);

    expect(remainingWhenCalled).toEqual([5, 4, 3, 2, 1]);
  });

  it('deletes every staged file once the batch is done', async () => {
    const files = [await stage('a.csv', 'x'), await stage('b.csv', 'y')];

    await processUpload('user-1', files);

    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('still deletes a file whose import threw, and keeps going', async () => {
    const files = [await stage('bad.csv', 'x'), await stage('good.csv', 'y')];
    importOneFile
      .mockRejectedValueOnce(new Error('unparseable'))
      .mockResolvedValueOnce({ success: true, personIds: [], touchesHero: false });

    const results = await processUpload('user-1', files);

    expect(results[0]).toMatchObject({ filename: 'bad.csv', success: false, error: 'unparseable' });
    expect(results[1].success).toBe(true);
    // A failed file must not leak its bytes onto the disk mongod shares.
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it('still accepts in-memory files, so nothing else that calls it breaks', async () => {
    // createLegacySessionViaUploadPath hands processUpload a buffer
    // directly rather than a staged path.
    const results = await processUpload('user-1', [
      { buffer: Buffer.from('inline'), originalname: 'inline.csv' },
    ]);

    expect(importOneFile.mock.calls[0][0].buffer.toString()).toBe('inline');
    expect(results[0].success).toBe(true);
  });
});
