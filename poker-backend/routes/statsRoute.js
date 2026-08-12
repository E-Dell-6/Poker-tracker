import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
  getHeroStats,
  refreshHeroStats,
  getPersonStats,
  refreshPersonStats,
  listPlayerStats
} from '../controllers/statsController.js';

const router = express.Router();

router.get('/me', userAuth, getHeroStats);
router.post('/me/recompute', userAuth, refreshHeroStats);

router.get('/players', userAuth, listPlayerStats);
router.get('/person/:personId', userAuth, getPersonStats);
router.post('/person/:personId/recompute', userAuth, refreshPersonStats);

export default router;