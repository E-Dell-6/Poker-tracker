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

// --- Baseline -----------------------------------------------------------
//
// Everything below this point exists because the default used to be "no
// limit unless a route opted in", which left 49 of 59 routes with nothing
// at all. This inverts that: a flood is capped for every route, and the
// genuinely expensive ones then opt into something tighter.
//
// Keyed on IP, not user: it is mounted app-wide, ahead of userAuth, so
// req.userId does not exist yet. That makes it a coarse network-level
// backstop rather than a precision tool - the per-user limits below are
// the real control. (Deliberately no custom keyGenerator: the library's
// default already normalizes IPv6 properly, which a hand-rolled req.ip
// does not.)
//
// The ceiling is set by the client's own behaviour, not by taste.
// useHandImport polls GET /api/imports/:id once a second for the entire
// duration of an import (POLL_INTERVAL_MS = 1000), so a long import alone
// is ~300 requests per 5 minutes from one browser sitting still. Anything
// near that number would throttle a legitimate import to death; 1000 keeps
// 3x headroom over the poll while still cutting a flood to ~3/sec.
export const globalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
});

// --- Expensive endpoints ------------------------------------------------
//
// All of these are user-keyed, so they MUST be mounted after userAuth (see
// the note on importLimiter above).

// recomputeHeroStats loads every session containing a hero hand into
// memory with no pagination and computes over all of them synchronously.
// It's a button a human clicks, so a human-scale limit costs nothing and
// removes an unauthenticated-cost-amplification style hole from an
// authenticated one.
export const recomputeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: { error: 'Too many recomputes. Please wait before trying again.' },
});

// Live-computed reads that scan a user's whole hand corpus per call: the
// Study page's stakes/date filters (which the code notes are deliberately
// not cached) and the hand search. Generous, because changing a filter is
// a normal interaction and these fire on every change.
export const heavyReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: { error: 'Too many queries. Please wait a moment.' },
});

// Routes that start real ingestion work. POST /api/upload buffers up to
// 20x10MB in memory per request; POST /api/imports/:id/start kicks off the
// parse/EV pipeline. QUOTA.JOBS_PER_DAY is 10, so this is well clear of
// any legitimate use while bounding how fast the box can be asked to chew.
export const ingestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: { error: 'Too many uploads. Please wait before trying again.' },
});
