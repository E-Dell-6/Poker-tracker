import fs from 'fs/promises';
import path from 'path';
import ImportJob from '../model/ImportJob.js';
import { importOneFile } from './handImportPipeline.js';
import { createPersonResolver } from './personResolver.js';
import { recomputeStatsForPersonIds } from './statsService.js';
import { STAGING, QUOTA } from '../config/limits.js';

// In-process job runner for staged bulk imports.
//
// Concurrency is 1 by design. The box has 1-2 cores shared with mongod, so
// running two imports at once makes both finish later while the API stalls
// for everyone else; the win comes from not blocking the event loop
// (handImportPipeline yields during the EV pass), not from parallelism.
//
// IMPORTANT: this queue lives in one Node process. Under pm2 it must run
// in fork mode / a single instance - `cluster` with instances > 1 would
// give every worker its own copy of this queue and they would race for the
// same jobs.

const queue = [];
let draining = false;

export function enqueueJob(jobId) {
  const id = String(jobId);
  if (!queue.includes(id)) queue.push(id);
  drain();
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const jobId = queue.shift();
      try {
        await runJob(jobId);
      } catch (err) {
        // A job that throws out here is a bug or an infrastructure
        // failure, not a bad file (those are caught per-file below).
        console.error(`[import] job ${jobId} failed:`, err);
        await ImportJob.updateOne(
          { _id: jobId },
          { $set: { status: 'failed', error: err.message, finishedAt: new Date() } }
        ).catch(() => {});
      }
    }
  } finally {
    draining = false;
  }
}

// mongod shares this filesystem, and a full disk corrupts it. This is a
// floor for the whole box, checked before a job commits to writing.
async function assertDiskHeadroom() {
  try {
    const stat = await fs.statfs(STAGING.DIR);
    const free = stat.bavail * stat.bsize;
    if (free < QUOTA.MIN_FREE_DISK_BYTES) {
      throw new Error('The server is low on disk space. Please try again later.');
    }
  } catch (err) {
    if (err.message.includes('low on disk space')) throw err;
    // statfs is unavailable on some platforms; not a reason to refuse work.
  }
}

async function isCancelled(jobId) {
  const current = await ImportJob.findById(jobId).select('status').lean();
  return !current || current.status === 'cancelled';
}

async function runJob(jobId) {
  const job = await ImportJob.findById(jobId).lean();
  if (!job) return;
  if (job.status !== 'queued' && job.status !== 'running') return;

  await assertDiskHeadroom();

  const userId = job.userId;
  await ImportJob.updateOne(
    { _id: jobId },
    { $set: { status: 'running', startedAt: job.startedAt || new Date(), error: null } }
  );

  // One resolver for the whole job - it caches this user's Person set in
  // memory, which is what turns ~100k lookups into ~2.
  const resolver = await createPersonResolver(userId);

  const personIds = new Set();
  let touchesHero = false;

  // Running totals kept in memory and always written with $set, so the
  // mid-file progress ticks below can't double-count against the per-file
  // update.
  const totals = {
    filesDone: job.progress?.filesDone || 0,
    handsImported: job.progress?.handsImported || 0,
    handsSkipped: job.progress?.handsSkipped || 0,
    handsDuplicate: job.progress?.handsDuplicate || 0,
  };

  const writeProgress = () =>
    ImportJob.updateOne({ _id: jobId }, { $set: { progress: { ...totals } } });

  for (let i = 0; i < job.files.length; i++) {
    const file = job.files[i];
    // Already-processed files are skipped on a resume, which is the whole
    // reason status is tracked per file rather than per job.
    if (file.status !== 'pending') continue;

    if (await isCancelled(jobId)) {
      console.log(`[import] job ${jobId} cancelled, stopping`);
      return;
    }

    const setFile = (fields) =>
      ImportJob.updateOne(
        { _id: jobId },
        { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`files.${i}.${k}`, v])) }
      );

    try {
      const buffer = await fs.readFile(file.storedPath);

      const handsBefore = totals.handsImported;
      const result = await importOneFile({
        userId,
        buffer,
        filename: file.originalName,
        resolver,
        // Fires every PROGRESS_EVERY_N_HANDS during the EV pass so a long
        // file still shows movement instead of looking hung.
        onProgress: async (handsDone) => {
          totals.handsImported = handsBefore + handsDone;
          await writeProgress();
        },
      });

      if (result.success) {
        result.personIds.forEach(id => personIds.add(id));
        touchesHero = touchesHero || result.touchesHero;

        totals.handsImported = handsBefore + result.totalHands;
        totals.handsSkipped += result.handsSkipped || 0;
        await setFile({
          status: 'done',
          handsImported: result.totalHands,
          handsSkipped: result.handsSkipped || 0,
          error: null,
        });
      } else {
        // A duplicate file is an expected outcome, not a failure - folder
        // imports routinely overlap with what's already been uploaded.
        totals.handsImported = handsBefore;
        if (result.duplicate) totals.handsDuplicate += 1;
        totals.handsSkipped += result.handsSkipped || 0;
        await setFile({
          status: result.duplicate ? 'skipped' : 'failed',
          handsSkipped: result.handsSkipped || 0,
          error: result.error,
        });
      }
    } catch (err) {
      console.error(`[import] job ${jobId} file ${file.originalName}:`, err.message);
      await setFile({ status: 'failed', error: err.message });
    } finally {
      // The staged copy has served its purpose either way; the hands are
      // in Mongo now, or the file was rejected.
      await fs.unlink(file.storedPath).catch(() => {});
      totals.filesDone += 1;
      await writeProgress();
    }
  }

  await removeJobStagingDir(jobId);

  // ONE recompute for the whole job, before the job reports itself done -
  // so "done" means the user's stats actually reflect the import, not that
  // they're still settling in the background.
  //
  // This is only affordable because recomputeStatsForPersonIds does a
  // single bucketed pass: per-person recomputes measured ~508s for the 400
  // opponents in a 20k-hand import, versus ~4.8s batched.
  if (personIds.size > 0 || touchesHero) {
    try {
      await recomputeStatsForPersonIds(userId, personIds, touchesHero);
    } catch (err) {
      // Stats are derived data and can be rebuilt on demand, so a failure
      // here doesn't invalidate an import whose hands are already saved.
      console.error(`[import] stats recompute failed for job ${jobId}:`, err);
    }
  }

  await ImportJob.updateOne(
    { _id: jobId },
    { $set: { status: 'done', finishedAt: new Date(), progress: { ...totals } } }
  );
}

export async function removeJobStagingDir(jobId) {
  await fs.rm(path.join(STAGING.DIR, String(jobId)), { recursive: true, force: true }).catch(() => {});
}

// Called once at startup.
//
// Because this runs on a persistent host filesystem rather than an
// ephemeral container, a job interrupted by a restart still has its staged
// files on disk - so it can be resumed from the first file still 'pending'
// instead of being failed and re-uploaded. Files already marked done are
// skipped, so no hand is imported twice.
export async function resumeInterruptedJobs() {
  const interrupted = await ImportJob.find({ status: { $in: ['running', 'queued'] } })
    .select('_id files')
    .lean();

  for (const job of interrupted) {
    const pending = (job.files || []).filter(f => f.status === 'pending');
    // Verify the staged files are actually still there before promising a
    // resume - if the staging dir was wiped by hand, fail cleanly instead.
    const survivors = await Promise.all(
      pending.map(f => fs.access(f.storedPath).then(() => true).catch(() => false))
    );

    if (pending.length > 0 && survivors.every(ok => !ok)) {
      await ImportJob.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', error: 'Interrupted by a restart and staged files are no longer available. Please re-upload.', finishedAt: new Date() } }
      );
      continue;
    }

    console.log(`[import] resuming job ${job._id} (${pending.length} file(s) pending)`);
    enqueueJob(job._id);
  }
}

// Deletes staging directories with no live job, and anything older than
// ORPHAN_MAX_AGE_MS regardless. Without this, every failed or cancelled
// job leaks its staged files onto the same disk mongod lives on.
export async function sweepOrphanedStagingDirs() {
  let entries;
  try {
    entries = await fs.readdir(STAGING.DIR, { withFileTypes: true });
  } catch {
    return; // staging dir doesn't exist yet - nothing to sweep
  }

  const liveIds = new Set(
    (await ImportJob.find({ status: { $in: ['staging', 'queued', 'running'] } }).select('_id').lean())
      .map(j => String(j._id))
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(STAGING.DIR, entry.name);
    try {
      if (liveIds.has(entry.name)) continue;
      const stat = await fs.stat(full);
      const age = Date.now() - stat.mtimeMs;
      if (age > STAGING.ORPHAN_MAX_AGE_MS || !liveIds.has(entry.name)) {
        await fs.rm(full, { recursive: true, force: true });
        console.log(`[import] swept orphaned staging dir ${entry.name}`);
      }
    } catch { /* raced with another cleanup; fine */ }
  }
}
