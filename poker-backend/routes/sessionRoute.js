import express from 'express';
import multer from 'multer';
import userAuth from '../middleware/userAuth.js';
import { destructiveLimiter } from '../middleware/rateLimiter.js';
import {
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, adjust as needed
});

router.get('/sessions', userAuth, listSessions);
router.get('/sessions/stakes', userAuth, listStakes);
router.get('/sessions/:id/hands', userAuth, getSessionHands);
router.get('/hands/search', userAuth, searchHands);
router.post('/sessions', userAuth, createLegacySession);
// upload.array lets the client send several files under the same 'csvFile'
// field name in one request.
router.post('/upload', userAuth, upload.array('csvFile', 20), handleMulterError, uploadSessions);
// Wipes a user's entire history in one call, previously with no
// throttle whatsoever. Limiter goes after userAuth so it can key on
// req.userId rather than the IP.
router.delete('/reset', userAuth, destructiveLimiter, resetSessions);
router.put('/sessions/:id', userAuth, updateSession);
router.patch('/sessions/:sessionId/hands/:handId/notes', userAuth, updateHandNotes);
router.delete('/sessions/:id', userAuth, deleteSession);

export default router;
