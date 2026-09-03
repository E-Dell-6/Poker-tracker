import mongoose from 'mongoose';

// One staged file within a job. `storedPath` points at a file on the host
// filesystem (see config/limits.js STAGING.DIR) - the bytes deliberately
// don't live in Mongo, only the reference does.
//
// `status` is per-file rather than per-job because it's what makes resume
// work: if the process restarts mid-import, the runner picks up from the
// first file still 'pending' instead of re-importing everything that
// already landed. That only holds because the host disk is persistent.
const ImportFileSchema = new mongoose.Schema({
  storedPath: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  sha256: { type: String, required: true },
  // Set at staging time by the content sniff, not from the filename.
  // Null means the sniff rejected it - such files are deleted immediately
  // and recorded as 'failed' without ever being queued.
  format: { type: String, enum: ['ACR', 'GGPOKER', 'POKERNOW', null], default: null },
  status: {
    type: String,
    enum: ['pending', 'done', 'skipped', 'failed'],
    default: 'pending',
  },
  handsImported: { type: Number, default: 0 },
  // Hands present in the file that were already in this user's HandLedger.
  handsSkipped: { type: Number, default: 0 },
  error: { type: String, default: null },
}, { _id: false });

const ImportJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },

  // 'staging' while the client is still uploading batches into this job -
  // the runner ignores those. It only becomes 'queued' when the client
  // explicitly calls POST /api/imports/:id/start, so a half-uploaded
  // folder is never processed.
  status: {
    type: String,
    enum: ['staging', 'queued', 'running', 'done', 'failed', 'cancelled'],
    default: 'staging',
    index: true,
  },

  totalFiles: { type: Number, default: 0 },
  totalBytes: { type: Number, default: 0 },

  files: [ImportFileSchema],

  // Denormalized running totals so the progress poll is a single cheap
  // document read instead of an aggregation over `files` on every tick.
  progress: {
    filesDone: { type: Number, default: 0 },
    handsImported: { type: Number, default: 0 },
    handsSkipped: { type: Number, default: 0 },
    handsDuplicate: { type: Number, default: 0 },

    // 'importing' covers the whole file loop above; every file can be
    // 'done' (filesDone === totalFiles) while the job is still very much
    // in progress, because ONE stats recompute runs after the last file
    // and before status flips to 'done' (see importRunner.js). Without a
    // stage the poll response looks identical for the length of that
    // recompute - stuck at "120/120 files, 20,000 hands" - which reads as
    // hung rather than working. personsDone/personsTotal give that phase
    // its own numbers to move.
    stage: { type: String, enum: ['importing', 'finalizing'], default: 'importing' },
    personsDone: { type: Number, default: 0 },
    personsTotal: { type: Number, default: 0 },
  },

  // Job-level failure (quota refused, disk full, unexpected throw). A file
  // that fails on its own leaves this null and records its error on the
  // file entry instead - one bad file never fails the whole job.
  error: { type: String, default: null },

  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
});

// Serves both the user's own job history and the daily-quota window count.
ImportJobSchema.index({ userId: 1, createdAt: -1 });

const ImportJob = mongoose.models.ImportJob || mongoose.model('ImportJob', ImportJobSchema);
export default ImportJob;
