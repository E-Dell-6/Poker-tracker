import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getUserData, getStorageUsage } from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData);
userRouter.get('/storage', userAuth, getStorageUsage);

export default userRouter;