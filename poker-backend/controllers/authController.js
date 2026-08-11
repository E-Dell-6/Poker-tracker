import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userModel from '../model/User.js';
import getTransporter from '../config/nodeMailer.js';

const MIN_PASSWORD_LENGTH = 10;

// Basic type/shape guard. Prevents NoSQL injection payloads like
// { "email": { "$ne": null } } from ever reaching a Mongoose query,
// since only real strings are accepted for these fields.
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeEmail = (email) => email.trim().toLowerCase();

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none', // See note below re: CSRF if frontend/backend share a top-level domain
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req, res) => {
    const { name, email, password } = req.body;

    if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
        return res.json({ success: false, message: 'Missing Details' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        return res.json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const normalizedEmail = normalizeEmail(email);

    try {
        const existingUser = await userModel.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.json({ success: false, message: "User already Exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new userModel({ name: name.trim(), email: normalizedEmail, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, cookieOptions);

        return res.json({ success: true });

    } catch (error) {
        console.error('register error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
        return res.json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = normalizeEmail(email);

    try {
        const user = await userModel.findOne({ email: normalizedEmail });
        // Same generic message whether the email doesn't exist or the password
        // is wrong, so responses can't be used to enumerate registered emails.
        const isMatch = user ? await bcrypt.compare(password, user.password) : false;
        if (!user || !isMatch) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, cookieOptions);

        return res.json({ success: true });

    } catch (error) {
        console.error('login error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        });
        return res.json({ success: true, message: "Logged Out" });

    } catch (error) {
        console.error('logout error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const sendVerifyOtp = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!isNonEmptyString(userId)) {
            return res.json({ success: false, message: 'Not Authorized' });
        }

        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        if (user.isAccountVerified) {
            return res.json({ success: false, message: 'Account is already verified' });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));

        user.verifyOtp = otp;
        user.verifyOtpExpiredAt = Date.now() + 24 * 60 * 60 * 1000;

        await user.save();

        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Account Verification',
            text: `Your One Time Password is ${otp}. Verify your account using this OTP`
        };
        await getTransporter().sendMail(mailOptions);
        return res.json({ success: true, message: 'Verification OTP Sent on Email' });

    } catch (error) {
        console.error('sendVerifyOtp error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const verifyEmail = async (req, res) => {
    const { userId, otp } = req.body;
    if (!isNonEmptyString(userId) || !isNonEmptyString(otp)) {
        return res.json({ success: false, message: 'Missing Details' });
    }
    try {
        const user = await userModel.findById(userId);

        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (user.verifyOtp === '' || user.verifyOtp !== otp) {
            return res.json({ success: false, message: "Invalid otp" });
        }
        if (user.verifyOtpExpiredAt < Date.now()) {
            return res.json({ success: false, message: 'OTP Expired' });
        }

        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpiredAt = 0;

        await user.save();
        return res.json({ success: true, message: 'Email verified Successfully' });

    } catch (error) {
        console.error('verifyEmail error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const isAuthenticated = async (req, res) => {
    try {
        return res.json({ success: true });
    } catch (error) {
        console.error('isAuthenticated error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const sendResetOtp = async (req, res) => {
    const { email } = req.body;

    if (!isNonEmptyString(email)) {
        return res.json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    // Generic response regardless of whether the account exists, so this
    // endpoint can't be used to enumerate registered emails.
    const genericResponse = { success: true, message: 'If that email is registered, an OTP has been sent' };

    try {
        const user = await userModel.findOne({ email: normalizedEmail });
        if (!user) {
            return res.json(genericResponse);
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));

        user.resetOtp = otp;
        user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;

        await user.save();

        const mailOptions = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Password Reset OTP',
            text: `Your OTP for resetting your password is ${otp}. Use this OTP to proceed with resetting your password`
        };
        await getTransporter().sendMail(mailOptions);
        return res.json(genericResponse);

    } catch (error) {
        console.error('sendResetOtp error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!isNonEmptyString(email) || !isNonEmptyString(otp) || !isNonEmptyString(newPassword)) {
        return res.json({ success: false, message: 'Email, OTP, and new password required' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const normalizedEmail = normalizeEmail(email);

    try {
        const user = await userModel.findOne({ email: normalizedEmail });
        if (!user) {
            return res.json({ success: false, message: 'Invalid or expired OTP' });
        }
        if (user.resetOtp === "" || user.resetOtp !== otp) {
            return res.json({ success: false, message: 'Invalid or expired OTP' });
        }
        if (user.resetOtpExpireAt < Date.now()) {
            return res.json({ success: false, message: 'Invalid or expired OTP' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetOtp = '';
        user.resetOtpExpireAt = 0; // fixed: was resetOtpExpiredAt, which doesn't exist on the schema

        await user.save();
        return res.json({ success: true, message: 'Password Saved Successfully' });

    } catch (error) {
        console.error('resetPassword error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};