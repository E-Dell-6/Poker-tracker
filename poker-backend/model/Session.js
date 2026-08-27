import mongoose from 'mongoose';
import { HandSchema } from './PokerHands.js'; 

const SessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    uploadID: String,
    date: Date,
    gameType: String,
    // Which parser produced this session, and what currency amounts in
    // `hands` are logged in. The frontend's formatMoney.js uses `currency`
    // to decide whether to divide by 100 and what symbol to show (see the
    // CURRENCY_META map there) - add new currencies there, not just here.
    source: { type: String, enum: ['ACR', 'POKERNOW', 'GGPOKER'] },
    currency: { type: String, enum: ['USD', 'CAD', 'CHIPS'], default: 'CHIPS' },
    totalHands: Number,
    totalProfit: Number,
    hands: [HandSchema], 
    uploadDate: { type: Date, default: Date.now },
    
    fileHash: { type: String, index: true },
});

// The history list is always `find({ userId }).sort({ uploadDate: -1 })` -
// this compound index lets Mongo satisfy that directly from the index
// instead of scanning + in-memory sorting as session counts grow.
SessionSchema.index({ userId: 1, uploadDate: -1 });

const Session = mongoose.models.session || mongoose.model('Session', SessionSchema);
export default Session;