import mongoose from 'mongoose';

const sharedHandSchema = new mongoose.Schema({
    shareId:   { type: String, required: true, unique: true, index: true },
    userId:    { type: String, required: true },          // owner — for auth on revoke
    handId:    { type: String, required: true },          // original hand._id
    hand:      { type: mongoose.Schema.Types.Mixed, required: true }, // full hand snapshot
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 }, // auto-delete after 90 days
});

export default mongoose.model('SharedHand', sharedHandSchema);