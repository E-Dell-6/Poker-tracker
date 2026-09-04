import { ALLOWED_ORIGINS } from '../config/origins.js';

// CSRF defense.
//
// The session cookie is SameSite=None (it has to be - the SPA and the API
// are on different hosts), so the browser attaches it to cross-site
// requests too. CORS is not a defense against that: it governs who may
// READ a response, not who may CAUSE one. A "simple" request - a form POST
// with an urlencoded/text-plain/multipart body - is sent with no preflight
// at all, and the write lands whether or not the attacker can read the
// reply.
//
// Most routes here happen to survive that, because express.json() only
// parses application/json (so a forged simple POST arrives with an empty
// body) and DELETE/PUT/PATCH always preflight. But "the body is empty" is
// not the same as "nothing happened": POST /api/auth/send-verify-otp sends
// an email, POST /api/stats/me/recompute starts an expensive recompute,
// and POST /api/live-sessions/clock-in creates a row - all with no body
// required.
//
// So: for any state-changing method, require that the request came from an
// origin we recognize. Browsers always send Origin on POST/PUT/PATCH/DELETE
// (unlike Referer, which strips under some referrer policies), which is
// what makes this reliable. Requests with no Origin at all are allowed
// through: those are non-browser clients (curl, health checks, server-side
// callers), which carry no ambient cookie for an attacker to ride on.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default function verifyOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next();

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ success: false, message: 'Request blocked: untrusted origin' });
  }

  next();
}
