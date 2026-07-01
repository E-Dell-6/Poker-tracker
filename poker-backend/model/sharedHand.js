import mongoose from 'mongoose';

const sharedHandSchema = new mongoose.Schema({
    shareId:   { type: String, required: true, unique: true, index: true },
    userId:    { type: String, required: true },          
    handId:    { type: String, required: true },        
    hand:      { type: mongoose.Schema.Types.Mixed, required: true }, 
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
});

export default mongoose.model('SharedHand', sharedHandSchema);