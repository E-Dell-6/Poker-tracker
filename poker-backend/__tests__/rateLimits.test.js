import { describe, it, expect, vi } from 'vitest';
import {
  globalLimiter,
  recomputeLimiter,
  heavyReadLimiter,
  ingestLimiter,
} from '../middleware/rateLimiter.js';

// These drive the real middleware rather than asserting on config objects,
// because the thing worth pinning is the behaviour: at what count does it
// start refusing, and what does it count *per*.
//
// The per-user limiters are keyed on req.userId, which only exists after
// userAuth has run. If one is ever mounted before userAuth, every user
// collapses into the single key "undefined" and one person's activity
// locks out everyone else - so the isolation tests below are really
// checking mount order, one step removed.

function mockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    headersSent: false,
    setHeader: (k, v) => { headers[k] = v; },
    getHeader: (k) => headers[k],
    removeHeader: (k) => { delete headers[k]; },
  };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (b) => { res.body = b; res.headersSent = true; return res; };
  res.send = (b) => { res.body = b; res.headersSent = true; return res; };
  res.end = () => { res.headersSent = true; return res; };
  return res;
}

// Runs the limiter once and reports whether the request was allowed
// through (next() called) or refused.
// express-rate-limit consults req.app.get('trust proxy') when validating
// how the client address was derived. A mock without it makes the library
// swallow a TypeError and skip that check entirely - so supply it, and the
// test exercises the same path production does (server.js sets it to 1).
const asExpressReq = (req) => ({ app: { get: () => 1 }, headers: {}, ...req });

function hit(limiter, req) {
  return new Promise((resolve) => {
    const res = mockRes();
    const next = vi.fn(() => resolve({ allowed: true, res }));
    Promise.resolve(limiter(asExpressReq(req), res, next)).then(() => {
      if (!next.mock.calls.length) resolve({ allowed: false, res });
    });
  });
}

async function hitN(limiter, req, n) {
  let allowed = 0;
  for (let i = 0; i < n; i++) {
    if ((await hit(limiter, req)).allowed) allowed++;
  }
  return allowed;
}

describe('baseline limiter', () => {
  it('allows well past the rate the client itself polls at', async () => {
    // useHandImport polls GET /api/imports/:id every POLL_INTERVAL_MS
    // (1000ms) for the whole of an import. Over the limiter's 5-minute
    // window that is 300 requests from one idle browser. If the cap ever
    // drops near that number, long imports start failing halfway through -
    // so this is the invariant that couples the two.
    const POLL_INTERVAL_MS = 1000;
    const WINDOW_MS = 5 * 60 * 1000;
    const pollsPerWindow = WINDOW_MS / POLL_INTERVAL_MS;

    const req = { ip: '203.0.113.10', headers: {} };
    const allowed = await hitN(globalLimiter, req, pollsPerWindow);

    expect(allowed).toBe(pollsPerWindow); // 300 straight polls, none refused
  });

  it('eventually refuses a flood from one address', async () => {
    const req = { ip: '203.0.113.11', headers: {} };
    const allowed = await hitN(globalLimiter, req, 1200);

    expect(allowed).toBe(1000);
    const { allowed: nextOne, res } = await hit(globalLimiter, req);
    expect(nextOne).toBe(false);
    expect(res.statusCode).toBe(429);
  });

  it('counts each address separately', async () => {
    const a = { ip: '203.0.113.20', headers: {} };
    const b = { ip: '203.0.113.21', headers: {} };
    await hitN(globalLimiter, a, 1000);

    expect((await hit(globalLimiter, a)).allowed).toBe(false);
    expect((await hit(globalLimiter, b)).allowed).toBe(true);
  });
});

describe('per-user limiters', () => {
  const cases = [
    ['recomputeLimiter', recomputeLimiter, 10],
    ['ingestLimiter', ingestLimiter, 30],
    ['heavyReadLimiter', heavyReadLimiter, 300],
  ];

  for (const [name, limiter, max] of cases) {
    it(`${name} refuses the request after ${max} in the window`, async () => {
      const req = { ip: '198.51.100.1', userId: `user-${name}`, headers: {} };
      expect(await hitN(limiter, req, max)).toBe(max);

      const { allowed, res } = await hit(limiter, req);
      expect(allowed).toBe(false);
      expect(res.statusCode).toBe(429);
    });

    it(`${name} isolates users from each other, not by IP`, async () => {
      // Same IP, two users - a shared NAT or household must not let one
      // person exhaust another's budget.
      const ip = '198.51.100.9';
      const one = { ip, userId: `${name}-alice`, headers: {} };
      const two = { ip, userId: `${name}-bob`, headers: {} };

      await hitN(limiter, one, max);
      expect((await hit(limiter, one)).allowed).toBe(false);
      expect((await hit(limiter, two)).allowed).toBe(true);
    });
  }
});
