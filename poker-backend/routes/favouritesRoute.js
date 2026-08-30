import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
  listFavourites,
  toggleFavouriteHand,
  patchHoleCards,
  patchAction,
  patchName,
  patchBlinds,
  removeFavourite,
  clearAllFavourites,
} from '../controllers/favouritesController.js';

const router = express.Router();

router.use(userAuth);

router.get('/', listFavourites);
router.post('/:id', toggleFavouriteHand);
router.patch('/:id/holeCards', patchHoleCards);
router.patch('/:id/action', patchAction);
router.patch('/:id/name', patchName);
router.patch('/:id/blinds', patchBlinds);
router.delete('/:id', removeFavourite);
router.delete('/', clearAllFavourites);

export default router;
