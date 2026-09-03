import path from 'path';

// Every tunable that used to be a magic number at its use site lives here.
// Grouped by what they protect, because the reason a number has its value
// matters more than the number: several of these are pinned to properties
// of the deployment (nginx's client_max_body_size, the box's core count)
// rather than chosen freely.

const MB = 1024 * 1024;

// --- Upload shape -----------------------------------------------------
//
// BYTES_PER_REQUEST is the load-bearing one. The nginx in front of this
// app caps a request body at exactly 32MB (verified: 32MB accepted, 33MB
// rejected), and its 413 is an HTML page, not JSON - so a request that
// trips it surfaces to the browser as a JSON parse error rather than
// anything actionable. Batching at 8MB keeps 4x headroom and means nginx
// never has to be reconfigured; raising the nginx cap instead would just
// widen the DoS surface.
export const UPLOAD = {
  BYTES_PER_FILE: 10 * MB,
  FILES_PER_REQUEST: 25,
  BYTES_PER_REQUEST: 8 * MB,
  FILES_PER_JOB: 500,
  BYTES_PER_JOB: 100 * MB,
  // Only what a poker hand history can plausibly be. Checked before the
  // content sniff, which is the real gate - see importValidation.js.
  ALLOWED_EXTENSIONS: ['.txt', '.csv'],
  // How much of a file to read for format detection. The site name is on
  // the first non-blank line, so this is generous.
  SNIFF_BYTES: 64 * 1024,
};

// --- Per-user quotas --------------------------------------------------
//
// Signup is public, so these assume an adversary rather than a slip. The
// daily limits are the ones that actually bound cost: a single job is
// capped at 100MB, but nothing stops a user starting a new one the moment
// the last finishes.
export const QUOTA = {
  JOBS_PER_DAY: 10,
  BYTES_PER_DAY: 300 * MB,
  CONCURRENT_JOBS: 1,
  TOTAL_BYTES_STORED: 2 * 1024 * MB,
  TOTAL_HANDS_STORED: 1_000_000,
  // A malformed log full of junk names would otherwise mint an unbounded
  // number of Person docs, each of which is a row every later stats
  // recompute has to consider.
  NEW_PERSONS_PER_JOB: 5000,
  // Refuse to start any job below this much free disk. mongod shares the
  // filesystem, and a full disk corrupts it - this is a floor for the
  // whole box, not a per-user rule.
  MIN_FREE_DISK_BYTES: 5 * 1024 * MB,
};

// --- Processing -------------------------------------------------------
//
// The box has 1-2 cores and mongod is on the same machine, so the strategy
// throughout is to reduce work rather than parallelize it. YIELD_EVERY_N_HANDS
// is what keeps the API responsive during an import: the all-in EV pass is
// the CPU-heavy part (a preflop all-in is ~210k five-card evaluations) and
// without an await in that loop it blocks the event loop for every other
// request.
export const PROCESSING = {
  YIELD_EVERY_N_HANDS: 10000000,
  PROGRESS_EVERY_N_HANDS: 500,
  // Mongo's hard document ceiling is 16MB and hands are embedded in the
  // Session doc. Fail below it with a real message rather than letting the
  // driver throw its own.
  MAX_SESSION_BSON_BYTES: 14 * MB,
  // Monte Carlo trials for preflop all-in equity. 5000 matches the value
  // equityEngine.js used before this was configurable, so EV numbers stay
  // comparable with hands imported earlier. Dropping to ~2000 costs about
  // +-1% equity accuracy and is the first lever to pull if bulk imports
  // are too slow on this hardware.
  EQUITY_TRIALS: Number(process.env.EQUITY_TRIALS) || 5000,
};

// --- Staging ----------------------------------------------------------
//
// Deliberately NOT under poker-backend/uploads: server.js serves that
// directory publicly with express.static, so staging there would publish
// every uploaded hand history at a guessable URL. The host filesystem is
// persistent (bare Node on a Linux box, not an ephemeral container), which
// is what lets an interrupted job resume instead of being failed.
export const STAGING = {
  DIR: process.env.IMPORT_STAGING_DIR || path.resolve('/var/lib/pokerflow/import-staging'),
  // Directories with no matching job doc, or older than this, are swept at
  // boot. Long enough that a job interrupted over a weekend still resumes.
  ORPHAN_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
};
