// One allowlist, read by two things that must never disagree: the CORS
// policy (which decides who may read a response) and verifyOrigin (which
// decides who may cause a write). Keeping them as separate literals is how
// an origin gets removed from one and left behind in the other.

const PRODUCTION_ORIGINS = [
  'https://www.pokerflow.live',
  'https://pokerflow.live',
  'https://api.pokerflow.live',
];

// The Vite dev server was previously in the production list. A remote page
// can't forge an Origin header, so it was never directly exploitable - but
// it widens the set of pages the API will talk to for no benefit once
// deployed, so it's now development-only.
//
// NOTE: this is gated on NODE_ENV, so the server must actually run with
// NODE_ENV=production. If it doesn't, localhost stays allowed in prod.
const DEVELOPMENT_ORIGINS = ['http://localhost:5173'];

export const ALLOWED_ORIGINS =
  process.env.NODE_ENV === 'production'
    ? PRODUCTION_ORIGINS
    : [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];
