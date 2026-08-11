import UserModel from "../model/User.js";

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