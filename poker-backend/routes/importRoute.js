import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import userAuth from '../middleware/userAuth.js';
import { importLimiter } from '../middleware/rateLimiter.js';
import { importFileFilter } from '../services/importValidation.js';
import { UPLOAD } from '../config/limits.js';
import {
  prepareJob,
  handleMulterError,
  stageFiles,
  startImportJob,
  getImportJob,
  cancelImportJob,
} from '../controllers/importController.js';

const router = express.Router();

// diskStorage, not memoryStorage: a folder import is hundreds of files,
// and buffering them in RSS (plus the UTF-8 string copy and hand objects
// each one expands into) is what made the old path unusable at this size.
// The destination is per-job and prepareJob has already created it.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, req.jobStagingDir),
    // Random name: the client controls originalName, and it's kept on the
    // job doc for display. Never let it reach the filesystem.
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: {
    fileSize: UPLOAD.BYTES_PER_FILE,
    files: UPLOAD.FILES_PER_REQUEST,
    fields: 10,
  },
  fileFilter: importFileFilter,
});

// Batch upload. The client sends ~8MB at a time (well under the 32MB the
// nginx in front of this enforces) and every batch after the first passes
// ?jobId= to append to the same job.
router.post(
  '/',
  userAuth,
  importLimiter,
  prepareJob,
  upload.array('files', UPLOAD.FILES_PER_REQUEST),
  handleMulterError,
  stageFiles
);

router.post('/:id/start', userAuth, startImportJob);
router.get('/:id', userAuth, getImportJob);
router.delete('/:id', userAuth, cancelImportJob);

export default router;
