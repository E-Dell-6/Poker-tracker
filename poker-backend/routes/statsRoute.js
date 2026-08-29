import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
  getHeroStats,
  refreshHeroStats,
  getPersonStats,
  refreshPersonStats,
  listPlayerStats,
  getHeroEvGraphRoute
} from '../controllers/statsController.js';

const router = express.Router();

router.get('/me', userAuth, getHeroStats);
router.post('/me/recompute', userAuth, refreshHeroStats);
router.get('/me/ev-graph', userAuth, getHeroEvGraphRoute);

router.get('/players', userAuth, listPlayerStats);
router.get('/person/:personId', userAuth, getPersonStats);
router.post('/person/:personId/recompute', userAuth, refreshPersonStats);

export default router;