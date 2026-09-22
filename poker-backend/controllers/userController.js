import UserModel from "../model/User.js";
import Session from "../model/Session.js";
import { QUOTA } from "../config/limits.js";

export const getUserData = async (req, res) => {
    try {
        const userId = req.body.userId;
        if (typeof userId !== 'string' || userId.trim().length === 0) {
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
                isAccountVerified: user.isAccountVerified,
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
        if (typeof userId !== 'string' || userId.trim().length === 0) {
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