import mongoose from "mongoose";
import { ACCENT_KEYS, THEME_KEYS } from "../config/preferences.js";

const userSchema = new mongoose.Schema({
    // maxlength matters now that PATCH /api/user/profile can set this: with
    // no cap the only limit is express.json({ limit: '1mb' }).
    name: { type: String, required: true, trim: true, maxlength: 60 },
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

    // Presentation only. Enum-constrained at the schema because the accent
    // key ends up in a data-attribute that CSS selects on - see
    // config/preferences.js. Documents written before this field existed
    // have no `preferences` at all, so every read spreads DEFAULT_PREFERENCES
    // underneath rather than trusting the field to be there.
    preferences: {
        type: {
            theme: { type: String, enum: THEME_KEYS, default: 'dark' },
            accent: { type: String, enum: ACCENT_KEYS, default: 'orange' },
        },
        default: () => ({}),
        _id: false,
    },

});

const UserModel = mongoose.models.user || mongoose.model('user', userSchema);
export default UserModel;