import jwt from "jsonwebtoken";

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