import express from 'express';
import mongoose from 'mongoose';
import connectDB from '../config/db.js'; 
import cors from 'cors';
import cookieParser from "cookie-parser";
import 'dotenv/config'; 

import sessionRouter from '../routes/sessionRoute.js';
import favouritesRouter from '../routes/handRoute.js';
import peopleRouter from '../routes/peopleRoute.js';
import imageUploadRouter from '../routes/imageUploadRoute.js';
import authRouter from '../routes/authRoutes.js';
import userRouter from '../routes/userRoutes.js';
import liveSessionRouter from '../routes/liveSessionRoute.js';

const app = express();

// --- CRITICAL FIX FOR AZURE ---
app.set('trust proxy', 1); 
// ------------------------------

const PORT = process.env.PORT || 1111;

app.use(cookieParser());
app.use(cors({ 
  credentials: true, 
  origin: [
    'https://www.pokerflow.live', 
    'https://pokerflow.live', 
    'https://api.pokerflow.live',
    'http://localhost:5173',
  ],
}));
app.use(express.json());

// Routes
app.use('/api/', sessionRouter);
app.use('/uploads', express.static('uploads'));
app.use('/api/upload-image', imageUploadRouter);
app.use('/api/favourites', favouritesRouter);
app.use('/api/people', peopleRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/live-sessions', liveSessionRouter);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server started on port: ${PORT}`);
    if (process.env.MONGO_URI) {
        connectDB(process.env.MONGO_URI);
    } else {
        console.error("MONGO_URI is missing");
    }
});