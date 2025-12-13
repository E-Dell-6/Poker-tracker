import 'dotenv/config'; 
import express from 'express';
import mongoose from 'mongoose';
import connectDB from '../config/db.js'; 

const app = express();
const PORT = process.env.PORT || 1111;

// Connect to MongoDB
connectDB();

mongoose.connection.once('open', () => {
    console.log('Connected to mongoDB');
    app.listen(PORT, () => {
        console.log(`Server has started on port: ${PORT}`);
    });
});