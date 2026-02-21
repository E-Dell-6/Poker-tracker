import mongoose from 'mongoose';

const LiveSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    date: { type: Date, default: Date.now },
    clockInTime: { type: Date, required: true },
    clockOutTime: { type: Date, required: true },
    smallBlind: { type: Number, required: true },
    bigBlind: { type: Number, required: true },
    buyIns: { type: [Number], required: true },
    totalBuyIn: { type: Number, required: true },
    cashOut: { type: Number, required: true },
    totalProfit: { type: Number, required: true },
    gameType: { type: String, default: 'Cash Game' }
});

const LiveSession = mongoose.models.LiveSession || mongoose.model('LiveSession', LiveSessionSchema);
export default LiveSession;
