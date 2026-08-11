import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // Make sure MONGO_URI is only ever read from process.env
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not set');
        }

        const conn = await mongoose.connect(process.env.MONGO_URI);

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`Error connecting to MongoDB: ${err.message}`);
        process.exit(1);
    }
};

export default connectDB;