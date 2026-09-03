import rateLimit from 'express-rate-limit';
import { QUOTA } from '../config/limits.js';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // per IP, per window, across all /api/auth routes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
});

// Keyed on the authenticated user, NOT the IP - so it MUST be mounted
// after userAuth, or req.userId is undefined and every request shares one
// bucket. User-keying is the right choice here regardless: it can't be
// sidestepped by rotating IPs, and it stays correct if the proxy's
// X-Forwarded-For handling ever changes.
//
// This is a coarse backstop for request volume. The real limits on what an
// import costs (bytes/day, files, storage) live in services/importQuota.js,
// which can give a specific reason for refusing.
export const importLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    // Deliberately above QUOTA.JOBS_PER_DAY: a single job legitimately
    // makes many staging requests (one per ~8MB batch), so this bounds
    // request count while importQuota bounds actual work.
    max: QUOTA.JOBS_PER_DAY * (Math.ceil(500 / 25) + 4),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: { error: 'Daily import request limit reached. Please try again tomorrow.' },
});

// DELETE /api/reset wipes a user's entire history in one call and had no
// throttle at all.
export const destructiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: { error: 'Too many requests. Please wait before trying again.' },
});
