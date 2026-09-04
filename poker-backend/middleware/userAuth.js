import jwt from "jsonwebtoken";
import RevokedToken from "../model/RevokedToken.js";

// Returns 401 on failure, not 200.
//
// This previously answered every auth failure with HTTP 200 and
// { success: false }. Callers that only check res.ok therefore treated an
// expired cookie as success - the hand upload path reported a successful
// import that had silently done nothing. The body shape is unchanged so
// existing callers that read `success` still work.
const userAuth = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not Authorized Login Again' });
    }
    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if (!tokenDecode?.id) {
            return res.status(401).json({ success: false, message: 'Not Authorized Login Again' });
        }

        // A valid signature is no longer sufficient: a token the user has
        // logged out of stays cryptographically valid until its own expiry,
        // so the denylist is what makes logout take effect server-side.
        // See model/RevokedToken.js.
        //
        // One indexed lookup on a collection that holds only unexpired,
        // explicitly-revoked tokens - in the normal case it is empty.
        //
        // Tokens minted before jti existed have none, and can't be revoked
        // individually; they simply age out within their remaining 7 days.
        if (tokenDecode.jti) {
            const revoked = await RevokedToken.exists({ jti: tokenDecode.jti });
            if (revoked) {
                return res.status(401).json({ success: false, message: 'Not Authorized Login Again' });
            }
        }

        req.body = req.body || {};
        req.body.userId = tokenDecode.id;
        req.userId = tokenDecode.id; // survives multer overwriting req.body on multipart routes

        next();
    } catch (error) {
        // Don't leak jwt library internals
        console.error('userAuth error:', error.message);
        return res.status(401).json({ success: false, message: 'Not Authorized Login Again' });
    }
};

export default userAuth;
