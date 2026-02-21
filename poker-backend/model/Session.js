import mongoose from 'mongoose';
import { HandSchema } from './PokerHands.js'; // Import the HandSchema

const SessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    uploadID: String,
    date: Date,
    gameType: String,
    totalHands: Number,
    totalProfit: Number,
    hands: [HandSchema], // ← Use HandSchema instead of plain Array
    uploadDate: { type: Date, default: Date.now }
});

const Session = mongoose.models.session || mongoose.model('Session', SessionSchema);
export default Session;