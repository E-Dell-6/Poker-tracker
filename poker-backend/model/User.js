import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    //  lookups always match how it was stored
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 60 }, // bcrypt hashes are always 60 chars
    verifyOtp: { type: String, default: '' },
    verifyOtpExpiredAt: { type: Number, default: 0 },
    isAccountVerified: { type: Boolean, default: false },
    resetOtp: { type: String, default: '' },
    resetOtpExpireAt: { type: Number, default: 0 },

    // Running totals maintained by the import pipeline and by session
    // deletion, so a storage-quota check is one document read instead of
    // an aggregation over every session's embedded hands. Approximate by
    // design - they track what was written, not a re-measured truth.
    storageBytes: { type: Number, default: 0 },
    totalHands: { type: Number, default: 0 },

});

const UserModel = mongoose.models.user || mongoose.model('user', userSchema);
export default UserModel;