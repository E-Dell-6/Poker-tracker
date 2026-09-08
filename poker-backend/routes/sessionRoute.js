import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import userAuth from '../middleware/userAuth.js';
import { destructiveLimiter, heavyReadLimiter, ingestLimiter } from '../middleware/rateLimiter.js';
import {
  prepareCsvUpload,
  listSessions,
  listStakes,
  getSessionHands,
  searchHands,
  createLegacySession,
  uploadSessions,
  resetSessions,
  updateSession,
  updateHandNotes,
  deleteSession,
} from '../controllers/sessionController.js';
import { handleMulterError } from '../controllers/importController.js';

const router = express.Router();

// diskStorage, not memoryStorage: with 20 files allowed at 10MB each, the
// old config could hold 200MB of request body in RSS at once, before any
// parsing began. The import route already stages to disk for exactly this
// reason; this path now matches it.
//
// The client controls originalname and it is echoed back in the per-file
// results, so it must never reach the filesystem - random name on disk,
// original kept only as metadata.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, req.csvStagingDir),
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
});

router.get('/sessions', userAuth, listSessions);
router.get('/sessions/stakes', userAuth, listStakes);
router.get('/sessions/:id/hands', userAuth, getSessionHands);
router.get('/hands/search', userAuth, heavyReadLimiter, searchHands);
router.post('/sessions', userAuth, createLegacySession);
// upload.array lets the client send several files under the same 'csvFile'
// field name in one request.
router.post('/upload', userAuth, ingestLimiter, prepareCsvUpload, upload.array('csvFile', 20), handleMulterError, uploadSessions);
// Wipes a user's entire history in one call, previously with no
// throttle whatsoever. Limiter goes after userAuth so it can key on
// req.userId rather than the IP.
router.delete('/reset', userAuth, destructiveLimiter, resetSessions);
router.put('/sessions/:id', userAuth, updateSession);
router.patch('/sessions/:sessionId/hands/:handId/notes', userAuth, updateHandNotes);
router.delete('/sessions/:id', userAuth, deleteSession);

export default router;
