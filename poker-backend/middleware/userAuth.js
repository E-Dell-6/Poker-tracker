import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.json({ success: false, message: 'Not Authorized Login Again' });
    }
    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if (!tokenDecode?.id) {
            return res.json({ success: false, message: 'Not Authorized Login Again' });
        }

        req.body = req.body || {};
        req.body.userId = tokenDecode.id;
        req.userId = tokenDecode.id; // survives multer overwriting req.body on multipart routes

        next();
    } catch (error) {
        // Don't leak jwt library internals
        console.error('userAuth error:', error.message);
        return res.json({ success: false, message: 'Not Authorized Login Again' });
    }
};

export default userAuth;