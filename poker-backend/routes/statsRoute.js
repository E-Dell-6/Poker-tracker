import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { recomputeLimiter, heavyReadLimiter } from '../middleware/rateLimiter.js';
import {
  getHeroStats,
  refreshHeroStats,
  getFilteredHeroStats,
  getPersonStats,
  refreshPersonStats,
  listPlayerStats,
  getHeroEvGraphRoute
} from '../controllers/statsController.js';

const router = express.Router();

router.get('/me', userAuth, getHeroStats);
router.post('/me/recompute', userAuth, recomputeLimiter, refreshHeroStats);
router.get('/me/filtered', userAuth, heavyReadLimiter, getFilteredHeroStats);
router.get('/me/ev-graph', userAuth, heavyReadLimiter, getHeroEvGraphRoute);

router.get('/players', userAuth, listPlayerStats);
router.get('/person/:personId', userAuth, getPersonStats);
router.post('/person/:personId/recompute', userAuth, recomputeLimiter, refreshPersonStats);

export default router;