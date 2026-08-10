import mongoose from 'mongoose';

const LiveSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    date: { type: Date, default: Date.now },
    clockInTime: { type: Date, required: true },
    // Not known until the session ends, so these can't be required anymore.
    clockOutTime: { type: Date },
    smallBlind: { type: Number, required: true },
    bigBlind: { type: Number, required: true },
    buyIns: { type: [Number], required: true, default: [] },
    totalBuyIn: { type: Number, required: true, default: 0 },
    cashOut: { type: Number },
    totalProfit: { type: Number },
    gameType: { type: String, default: 'Cash Game' },
    status: { type: String, enum: ['active', 'completed'], default: 'active', index: true }
});

const LiveSession = mongoose.models.LiveSession || mongoose.model('LiveSession', LiveSessionSchema);
export default LiveSession;