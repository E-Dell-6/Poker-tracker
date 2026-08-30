import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
  getActiveSession,
  listCompletedSessions,
  clockIn,
  addBuyIn,
  clockOut,
  deleteSession,
} from '../controllers/liveSessionController.js';

const router = express.Router();

router.get('/active', userAuth, getActiveSession);
router.get('/', userAuth, listCompletedSessions);
router.post('/clock-in', userAuth, clockIn);
router.post('/:id/buy-in', userAuth, addBuyIn);
router.post('/:id/clock-out', userAuth, clockOut);
router.delete('/:id', userAuth, deleteSession);

export default router;
