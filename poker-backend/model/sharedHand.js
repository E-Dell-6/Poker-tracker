import mongoose from 'mongoose';
import { SHARE } from '../config/limits.js';

const sharedHandSchema = new mongoose.Schema({
    shareId:   { type: String, required: true, unique: true, index: true },
    userId:    { type: String, required: true },          
    handId:    { type: String, required: true },        
    hand:      { type: mongoose.Schema.Types.Mixed, required: true }, 
    createdAt: { type: Date, default: Date.now, expires: SHARE.LINK_TTL_SECONDS },
});

export default mongoose.model('SharedHand', sharedHandSchema);
