import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import userModel from '../model/User.js';
import getTransporter from '../config/nodeMailer.js';
import RevokedToken from '../model/RevokedToken.js';
import { isNonEmptyString, normalizeEmail } from '../utils/validate.js';

export const MIN_PASSWORD_LENGTH = 10;

// A real bcrypt hash (of a value nothing can log in with) used to keep the
// failed-login path doing the same work as the successful one. Generated
// once at startup rather than inlined as a constant so it always matches
// the cost factor used elsewhere in this file.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

// isNonEmptyString / normalizeEmail now come from utils/validate.js - the
// same guards are needed by userController.js, and three near-identical
// copies of a NoSQL-injection guard is how one of them drifts.

// Math.random() is not a CSPRNG - its output is derived from an internal
// state that can be recovered from previously observed values, and these
// six digits are the entire proof of identity for a password reset. The
// registration and reset flows both mint OTPs from the same helper, so
// neither can drift back to the weak source.
//
// randomInt is rejection-sampled, so the digits stay uniform (the obvious
// `% 900000` on a random integer does not).
const generateOtp = () => String(crypto.randomInt(100000, 1000000));

// SameSite=None is forced by the split-origin deployment (SPA on
// pokerflow.live, API on api.pokerflow.live), which means the browser
// attaches this cookie to cross-site requests. The CSRF consequence of
// that is handled at the edge by middleware/verifyOrigin.js, not here.
//
// Everything except maxAge is shared with the logout path below: a cookie
// is cleared by matching name/domain/path, and letting the two definitions
// drift is how a logout silently stops clearing anything.
const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
};

const sessionCookieOptions = {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Tokens carry a `jti` (a unique id for this specific token) purely so
// logout has something to revoke - see model/RevokedToken.js. Without it a
// stateless JWT cannot be invalidated before its own expiry.
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const issueSessionToken = (userId) =>
    jwt.sign(
        { id: userId, jti: crypto.randomUUID() },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_TTL_SECONDS }
    );

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

        const token = issueSessionToken(user._id);
        res.cookie('token', token, sessionCookieOptions);

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
        //
        // The message alone isn't enough. Skipping bcrypt for an unknown
        // email returned in ~0ms while a real account cost ~300ms at cost
        // 10 - a gap that large is trivially measurable over a network and
        // hands out exactly the user list the wording is trying to hide.
        // Always pay the hash, comparing against a dummy when there's no
        // user, so both paths take the same time.
        const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);
        if (!user || !isMatch) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        const token = issueSessionToken(user._id);
        res.cookie('token', token, sessionCookieOptions);

        return res.json({ success: true });

    } catch (error) {
        console.error('login error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};

// Clearing the cookie only tells a cooperating browser to stop sending the
// token; it does nothing about a copy of that token held anywhere else.
// Revoke it server-side as well, so the credential is dead everywhere and
// not merely absent from this one browser.
export const logout = async (req, res) => {
    // The cookie goes regardless of what happens below - a user who clicks
    // "log out" must never stay logged in on this device because a write
    // failed.
    clearSessionCookie(res);

    try {
        await revokeCurrentToken(req);
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

        const otp = generateOtp();

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

        const otp = generateOtp();

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

// Kills the token on the current request. Exported because both a password
// change (below) and account deletion need it, and both need it for the same
// reason: the credential that was in play when the action happened must not
// outlive the action taken against it.
//
// Not jwt.verify - an expired or malformed token needs no revoking (it
// already fails auth), and throwing here would turn a routine call into a 500.
export const revokeCurrentToken = async (req) => {
    const decoded = jwt.decode(req.cookies?.token);
    if (decoded?.jti && decoded?.exp) {
        await RevokedToken.updateOne(
            { jti: decoded.jti },
            { $setOnInsert: { jti: decoded.jti, expiresAt: new Date(decoded.exp * 1000) } },
            { upsert: true }
        );
    }
};

// A cookie is cleared by matching name/domain/path, so this has to use the
// same options object the cookie was set with - letting those drift is how a
// logout silently stops clearing anything.
export const clearSessionCookie = (res) => res.clearCookie('token', cookieOptions);

export const issueSessionCookie = (res, userId) =>
    res.cookie('token', issueSessionToken(userId), sessionCookieOptions);

export const changePassword = async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    if (!isNonEmptyString(userId) || !isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
        return res.json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (newPassword === currentPassword) {
        return res.json({ success: false, message: 'New password must be different from the current one' });
    }

    try {
        const user = await userModel.findById(userId);
        // Same always-pay-the-hash shape as login(), for the same reason:
        // skipping bcrypt on the no-user path returns in ~0ms where a real
        // account costs ~300ms, and that gap is measurable over a network.
        const isMatch = await bcrypt.compare(currentPassword, user ? user.password : DUMMY_PASSWORD_HASH);
        if (!user || !isMatch) {
            return res.json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Revoke the token this request arrived on and mint a fresh one, so
        // the user stays signed in HERE while a stolen copy of the old cookie
        // dies. A password change that left the old credential working would
        // defeat the main reason people change passwords.
        //
        // TODO: this revokes the current session only. RevokedToken is a jti
        // denylist with no per-user index, so "sign out of all other devices"
        // isn't expressible without a tokenVersion/passwordChangedAt field on
        // User plus a check in userAuth.js - and that check costs a user read
        // on every authenticated request, on top of the RevokedToken lookup
        // it already does.
        await revokeCurrentToken(req);
        issueSessionCookie(res, user._id);

        return res.json({ success: true, message: 'Password updated' });

    } catch (error) {
        console.error('changePassword error:', error);
        return res.json({ success: false, message: 'Something went wrong, please try again' });
    }
};
