import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getSharedHand, createShareLink, deleteShareLink } from '../controllers/shareController.js';

const router = express.Router();

router.get('/:shareId', getSharedHand);
router.post('/', userAuth, createShareLink);
router.delete('/:shareId', userAuth, deleteShareLink);

export default router;
