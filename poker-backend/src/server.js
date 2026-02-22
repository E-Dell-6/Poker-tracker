import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import cors from 'cors';
import cookieParser from "cookie-parser";

import sessionRouter from '../routes/sessionRoute.js';
import favouritesRouter from '../routes/handRoute.js';
import peopleRouter from '../routes/peopleRoute.js';
import imageUploadRouter from '../routes/imageUploadRoute.js';
import authRouter from '../routes/authRoutes.js';
import userRouter from '../routes/userRoutes.js';
import liveSessionRouter from '../routes/liveSessionRoute.js'; 

const app = express();
const PORT = process.env.PORT || 1111;

app.use(cookieParser());
app.use(cors({ 
  credentials: true, 
  origin: '192.168.1.100'
}));
app.use(express.json());

app.use('/api/', sessionRouter);
app.use('/uploads', express.static('uploads'));
app.use('/api/upload-image', imageUploadRouter);
app.use('/api/favourites', favouritesRouter);
app.use('/api/people', peopleRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/live-sessions', liveSessionRouter);

connectDB();

mongoose.connection.once('open', () => {
    console.log('Connected to mongoDB');
    app.listen(PORT, () => {
        console.log(`Server has started on port: ${PORT}`);
    });
});