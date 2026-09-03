import ImportJob from '../model/ImportJob.js';
import UserModel from '../model/User.js';
import { QUOTA, UPLOAD } from '../config/limits.js';

// Per-user import quotas.
//
// Signup is public, so these assume an adversary rather than a slip. The
// per-request multer limits bound one HTTP call; these bound what a user
// can do by making that call repeatedly, which is the part that actually
// costs disk and CPU.
//
// Every check returns a user-facing message rather than throwing - a
// refused import is an ordinary outcome the UI needs to explain, not an
// exception.

const DAY_MS = 24 * 60 * 60 * 1000;
// How long a job may sit in 'staging' before it's assumed abandoned.
// Generous: uploading 100MB of batches on a slow connection is slow,
// but nobody legitimately takes an hour between batches.
const STALE_STAGING_MS = 60 * 60 * 1000;

export async function checkImportQuota(userId, incomingBytes = 0) {
  // Only one import at a time per user. The runner is concurrency-1
  // anyway, so a second job would just queue - this makes that explicit
  // instead of letting someone stack 50 jobs deep.
  //
  // A 'staging' job only counts while it's plausibly still being uploaded.
  // Staging is client-driven - the browser sends batch after batch and
  // then calls /start - so a closed tab or a dropped connection leaves one
  // behind, and counting those forever would lock the user out of
  // importing with no way to recover. Anything past STALE_STAGING_MS is
  // treated as abandoned and swept below.
  const staleBefore = new Date(Date.now() - STALE_STAGING_MS);
  const active = await ImportJob.countDocuments({
    userId,
    $or: [
      { status: { $in: ['queued', 'running'] } },
      { status: 'staging', createdAt: { $gte: staleBefore } },
    ],
  });
  if (active >= QUOTA.CONCURRENT_JOBS) {
    return { error: 'You already have an import in progress. Wait for it to finish, or cancel it first.' };
  }

  // Retire whatever was abandoned, so its staged files become sweepable
  // and the user's job history doesn't fill with dead 'staging' rows.
  await ImportJob.updateMany(
    { userId, status: 'staging', createdAt: { $lt: staleBefore } },
    { $set: { status: 'cancelled', error: 'Abandoned before it was started.', finishedAt: new Date() } }
  );

  const since = new Date(Date.now() - DAY_MS);
  const recent = await ImportJob.find({ userId, createdAt: { $gte: since } })
    .select('totalBytes')
    .lean();

  if (recent.length >= QUOTA.JOBS_PER_DAY) {
    return { error: `Daily import limit reached (${QUOTA.JOBS_PER_DAY} imports per day). Try again tomorrow.` };
  }

  const bytesToday = recent.reduce((sum, j) => sum + (j.totalBytes || 0), 0);
  if (bytesToday + incomingBytes > QUOTA.BYTES_PER_DAY) {
    const mb = (QUOTA.BYTES_PER_DAY / 1024 / 1024).toFixed(0);
    return { error: `Daily upload limit reached (${mb}MB per day). Try again tomorrow.` };
  }

  // Stored totals are counters maintained by the import pipeline, so this
  // stays a single document read rather than an aggregation over sessions.
  const user = await UserModel.findById(userId).select('storageBytes totalHands').lean();
  if (user) {
    if ((user.storageBytes || 0) >= QUOTA.TOTAL_BYTES_STORED) {
      const gb = (QUOTA.TOTAL_BYTES_STORED / 1024 / 1024 / 1024).toFixed(0);
      return { error: `You've reached your ${gb}GB storage limit. Delete some sessions to import more.` };
    }
    if ((user.totalHands || 0) >= QUOTA.TOTAL_HANDS_STORED) {
      return { error: `You've reached the ${QUOTA.TOTAL_HANDS_STORED.toLocaleString()} hand limit. Delete some sessions to import more.` };
    }
  }

  return { ok: true };
}

// Bounds an in-progress job as batches append to it. Returns the message
// to reject with, or null to accept.
export function checkJobCapacity(job, incomingFiles, incomingBytes) {
  if ((job.totalFiles || 0) + incomingFiles > UPLOAD.FILES_PER_JOB) {
    return `This import would exceed ${UPLOAD.FILES_PER_JOB} files.`;
  }
  if ((job.totalBytes || 0) + incomingBytes > UPLOAD.BYTES_PER_JOB) {
    const mb = (UPLOAD.BYTES_PER_JOB / 1024 / 1024).toFixed(0);
    return `This import would exceed ${mb}MB.`;
  }
  return null;
}
