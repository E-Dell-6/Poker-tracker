import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { destructiveLimiter } from '../middleware/rateLimiter.js';
import {
    getUserData,
    getStorageUsage,
    updatePreferences,
    updateProfile,
    deleteAccount,
} from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData);
userRouter.get('/storage', userAuth, getStorageUsage);
// All non-safe methods, so middleware/verifyOrigin.js covers CSRF.
userRouter.patch('/preferences', userAuth, updatePreferences);
userRouter.patch('/profile', userAuth, updateProfile);
// Same limiter that guards DELETE /api/reset - this is the more destructive
// of the two.
userRouter.delete('/account', userAuth, destructiveLimiter, deleteAccount);

export default userRouter;
