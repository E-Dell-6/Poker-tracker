import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import ImportJob from '../model/ImportJob.js';
import { sniffStagedFile } from '../services/importValidation.js';
import { checkImportQuota, checkJobCapacity } from '../services/importQuota.js';
import { enqueueJob, removeJobStagingDir } from '../services/importRunner.js';
import { STAGING, UPLOAD } from '../config/limits.js';

// Runs BEFORE multer so the destination directory exists and quota is
// checked before a single byte is written to disk.
//
// The first batch of a folder import creates the job; every later batch
// passes ?jobId= and appends to it. The job sits in 'staging' the whole
// time and is only queued when the client explicitly calls /start, so a
// half-uploaded folder is never processed.
export async function prepareJob(req, res, next) {
  try {
    const declaredBytes = Number(req.headers['content-length']) || 0;

    if (req.query.jobId) {
      const job = await ImportJob.findOne({ _id: req.query.jobId, userId: req.userId });
      if (!job) return res.status(404).json({ error: 'Import not found' });
      if (job.status !== 'staging') {
        return res.status(409).json({ error: 'This import has already started and cannot accept more files.' });
      }
      req.importJob = job;
    } else {
      const quota = await checkImportQuota(req.userId, declaredBytes);
      if (quota.error) return res.status(429).json({ error: quota.error });

      req.importJob = await ImportJob.create({ userId: req.userId, status: 'staging' });

      // The job doc exists before multer has accepted a single byte, so
      // every downstream rejection - a bad extension, a 26th file, an
      // oversized file - would otherwise leave it stranded in 'staging'
      // with no files. That matters because the concurrent-job guard
      // counts staging jobs: one malformed upload would lock the user out
      // of importing anything, permanently. Cleaning up on 'finish'
      // catches every failure path, including an unexpected throw.
      const createdJobId = req.importJob._id;
      res.on('finish', () => {
        if (res.statusCode < 400) return;
        ImportJob.deleteOne({ _id: createdJobId, 'files.0': { $exists: false } })
          .then(({ deletedCount }) => deletedCount && removeJobStagingDir(createdJobId))
          .catch(err => console.error('[import] failed to clean up rejected job:', err.message));
      });
    }

    req.jobStagingDir = path.join(STAGING.DIR, String(req.importJob._id));
    try {
      await fs.mkdir(req.jobStagingDir, { recursive: true });
    } catch (err) {
      // A staging dir the server can't write is a deploy fault, not a bad
      // upload. Without this it fell through to handleMulterError's
      // catch-all and came back as a 400 carrying a raw ENOENT string,
      // which reads as "your file was rejected" to both the user and
      // whoever is debugging it.
      console.error(`[import] staging dir unusable (${req.jobStagingDir}):`, err.message);
      return res.status(503).json({
        error: 'Imports are temporarily unavailable - the server could not open its staging directory.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Multer's own middleware fails BEFORE the handler runs, by calling
// next(err), which skips to Express's default handler and returns an HTML
// error page instead of JSON - and the frontend then throws a SyntaxError
// parsing it. This keeps upload failures in the same JSON { error } shape
// as everything else. Modeled on imageController.handleUploadError, which
// the session upload route never had.
export function handleMulterError(err, req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = (UPLOAD.BYTES_PER_FILE / 1024 / 1024).toFixed(0);
      return res.status(400).json({ error: `Each file must be under ${mb}MB` });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: `Send at most ${UPLOAD.FILES_PER_REQUEST} files per request` });
    }
  }
  res.status(400).json({ error: err.message || 'Upload failed' });
}

// Records the batch multer just wrote, after validating each file's actual
// content. Returns 202 with the job id - nothing is parsed yet.
export async function stageFiles(req, res) {
  const job = req.importJob;

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const incomingBytes = req.files.reduce((sum, f) => sum + f.size, 0);
    const overCapacity = checkJobCapacity(job, req.files.length, incomingBytes);
    if (overCapacity) {
      await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {})));
      return res.status(413).json({ error: overCapacity });
    }

    const staged = [];
    const rejected = [];

    for (const file of req.files) {
      // The extension was checked by the fileFilter, but anything can be
      // named .txt - this reads the file's actual leading bytes and asks
      // the same detector the parsers use. Junk is deleted here, while
      // it's still one small file on disk.
      const { format, error } = await sniffStagedFile(file.path);
      if (error) {
        await fs.unlink(file.path).catch(() => {});
        rejected.push({ filename: file.originalname, error });
        continue;
      }

      const buffer = await fs.readFile(file.path);
      staged.push({
        storedPath: file.path,
        originalName: file.originalname,
        size: file.size,
        sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
        format,
        status: 'pending',
      });
    }

    if (staged.length > 0) {
      job.files.push(...staged);
      job.totalFiles = job.files.length;
      job.totalBytes = (job.totalBytes || 0) + staged.reduce((sum, f) => sum + f.size, 0);
      await job.save();
    }

    res.status(202).json({
      jobId: job._id,
      stagedCount: staged.length,
      totalFiles: job.totalFiles,
      totalBytes: job.totalBytes,
      rejected,
    });
  } catch (err) {
    console.error('[import] staging failed:', err);
    res.status(500).json({ error: 'Failed to stage files' });
  }
}

// Hands the job to the runner. Separate from staging so the client can
// upload many batches and only then commit to processing them.
export async function startImportJob(req, res) {
  try {
    const job = await ImportJob.findOne({ _id: req.params.id, userId: req.userId });
    if (!job) return res.status(404).json({ error: 'Import not found' });

    if (job.status !== 'staging') {
      return res.status(409).json({ error: `This import is already ${job.status}.` });
    }
    if (job.files.length === 0) {
      return res.status(400).json({ error: 'No valid files were uploaded for this import.' });
    }

    job.status = 'queued';
    await job.save();
    enqueueJob(job._id);

    res.status(202).json({ jobId: job._id, status: job.status, totalFiles: job.totalFiles });
  } catch (err) {
    console.error('[import] start failed:', err);
    res.status(500).json({ error: 'Failed to start import' });
  }
}

// The one job a freshly-loaded page can still be shown progress for.
//
// Only 'queued'/'running' count: those keep going on the server whether or
// not any browser is watching, so a reload (or a second tab, or another
// device) can pick the job back up and keep reporting it. A 'staging' job
// deliberately does NOT count - staging means the client was still
// uploading batches, and those bytes only ever existed in the tab that's
// now gone, so the job will never start. Reporting it would leave a
// progress card up forever. (checkImportQuota sweeps those away.)
export async function getActiveImportJob(req, res) {
  try {
    const job = await ImportJob.findOne({ userId: req.userId, status: { $in: ['queued', 'running'] } })
      .sort({ createdAt: -1 })
      .select('status totalFiles progress error createdAt startedAt')
      .lean();

    if (!job) return res.json({ job: null });

    res.json({
      job: {
        jobId: job._id,
        status: job.status,
        totalFiles: job.totalFiles,
        progress: job.progress,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read import status' });
  }
}

// The progress poll. Deliberately small: the client hits this about once a
// second, so it returns the denormalized counters and per-file outcomes
// rather than anything that needs computing.
export async function getImportJob(req, res) {
  try {
    const job = await ImportJob.findOne({ _id: req.params.id, userId: req.userId })
      .select('status totalFiles totalBytes progress error createdAt startedAt finishedAt files.originalName files.status files.handsImported files.handsSkipped files.error')
      .lean();

    if (!job) return res.status(404).json({ error: 'Import not found' });

    res.json({
      jobId: job._id,
      status: job.status,
      totalFiles: job.totalFiles,
      progress: job.progress,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      files: job.files,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read import status' });
  }
}

// Cancels a staging or in-flight job. The runner checks for this between
// files, so an already-imported file stays imported - cancelling stops
// further work rather than rolling back.
export async function cancelImportJob(req, res) {
  try {
    const job = await ImportJob.findOne({ _id: req.params.id, userId: req.userId });
    if (!job) return res.status(404).json({ error: 'Import not found' });

    if (['done', 'failed', 'cancelled'].includes(job.status)) {
      return res.status(409).json({ error: `This import is already ${job.status}.` });
    }

    job.status = 'cancelled';
    job.finishedAt = new Date();
    await job.save();

    await removeJobStagingDir(job._id);
    res.json({ jobId: job._id, status: job.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel import' });
  }
}
