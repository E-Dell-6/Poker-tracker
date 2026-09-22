import bcrypt from "bcryptjs";
import UserModel from "../model/User.js";
import Session from "../model/Session.js";
import { QUOTA } from "../config/limits.js";
import { DEFAULT_PREFERENCES, sanitizePreferences } from "../config/preferences.js";
import { isNonEmptyString } from "../utils/validate.js";
import { purgeAccount } from "../services/accountService.js";
import { revokeCurrentToken, clearSessionCookie } from "./authController.js";

const MAX_NAME_LENGTH = 60;

export const getUserData = async (req, res) => {
    try {
        const userId = req.body.userId;
        if (!isNonEmptyString(userId)) {
            return res.json({ success: false, message: 'Not Authorized' });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not Found' });
        }

        return res.json({
            success: true,
            userData: {
                name: user.name,
                email: user.email,
                isAccountVerified: user.isAccountVerified,
                // Spread over the defaults rather than returning the field
                // directly: documents written before `preferences` existed
                // don't have it at all, the same reason storageBytes needs
                // its `|| 0` below.
                preferences: { ...DEFAULT_PREFERENCES, ...(user.preferences?.toObject?.() ?? user.preferences ?? {}) },
            }
        });
    } catch (error) {
        console.error('getUserData error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

// The storage numbers the import quota is actually enforced against, so the
// user can see how close they are before an import is refused (see
// checkImportQuota in services/importQuota.js). Reads the running counters on
// the user document rather than aggregating over every session's embedded
// hands - same single-document-read reasoning as the quota check itself.
export const getStorageUsage = async (req, res) => {
    try {
        // userAuth sets both req.body.userId and req.userId; prefer the latter.
        const userId = req.userId;
        if (!isNonEmptyString(userId)) {
            return res.json({ success: false, message: 'Not Authorized' });
        }

        const [user, sessionCount] = await Promise.all([
            UserModel.findById(userId).select('storageBytes totalHands').lean(),
            Session.countDocuments({ userId }),
        ]);
        if (!user) {
            return res.json({ success: false, message: 'User not Found' });
        }

        return res.json({
            success: true,
            storage: {
                bytesUsed: user.storageBytes || 0,
                bytesLimit: QUOTA.TOTAL_BYTES_STORED,
                handsUsed: user.totalHands || 0,
                handsLimit: QUOTA.TOTAL_HANDS_STORED,
                sessionCount,
            }
        });
    } catch (error) {
        console.error('getStorageUsage error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};
export const updatePreferences = async (req, res) => {
    try {
        // userAuth sets both req.body.userId and req.userId; prefer the latter.
        const userId = req.userId;
        if (!isNonEmptyString(userId)) {
            return res.json({ success: false, message: 'Not Authorized' });
        }

        // Builds the patch from a known key list rather than filtering the
        // body, so the `userId` userAuth injected is dropped with no special
        // case and an unknown key can't slip through - see config/preferences.js.
        const patch = sanitizePreferences(req.body);
        if (!patch) {
            return res.json({ success: false, message: 'Invalid preferences' });
        }

        const user = await UserModel.findByIdAndUpdate(userId, { $set: patch }, { new: true })
            .select('preferences').lean();
        if (!user) {
            return res.json({ success: false, message: 'User not Found' });
        }

        return res.json({
            success: true,
            preferences: { ...DEFAULT_PREFERENCES, ...(user.preferences ?? {}) },
        });
    } catch (error) {
        console.error('updatePreferences error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId;
        if (!isNonEmptyString(userId)) {
            return res.json({ success: false, message: 'Not Authorized' });
        }

        const { name } = req.body;
        if (!isNonEmptyString(name)) {
            return res.json({ success: false, message: 'Name is required' });
        }
        const trimmed = name.trim();
        if (trimmed.length > MAX_NAME_LENGTH) {
            return res.json({ success: false, message: `Name must be ${MAX_NAME_LENGTH} characters or fewer` });
        }

        const user = await UserModel.findByIdAndUpdate(
            userId,
            { $set: { name: trimmed } },
            { new: true, runValidators: true }
        ).select('name').lean();
        if (!user) {
            return res.json({ success: false, message: 'User not Found' });
        }

        return res.json({ success: true, name: user.name });
    } catch (error) {
        console.error('updateProfile error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

// Irreversible, so the password is re-verified here regardless of whatever
// the client asked the user to type - the typed-email confirmation on the
// frontend is friction, not security.
export const deleteAccount = async (req, res) => {
    try {
        const userId = req.userId;
        if (!isNonEmptyString(userId)) {
            return res.json({ success: false, message: 'Not Authorized' });
        }

        const { password } = req.body;
        if (!isNonEmptyString(password)) {
            return res.json({ success: false, message: 'Password is required' });
        }

        const user = await UserModel.findById(userId).select('password');
        if (!user) {
            return res.json({ success: false, message: 'User not Found' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: 'Password is incorrect' });
        }

        await purgeAccount(userId);

        // The account is gone, so the token naming it must be too - both
        // revoked server-side and cleared from this browser.
        await revokeCurrentToken(req);
        clearSessionCookie(res);

        return res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
        console.error('deleteAccount error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};
