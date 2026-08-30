// Tiny in-process TTL cache for live-filtered stats computations (see
// computeFilteredHeroStats/getHeroEvGraph in statsService.js) - filtering by
// stakes/date can't be pushed down to a Mongo query (hands are embedded
// sub-documents with no per-hand index), so a repeated filter combo would
// otherwise re-fetch and re-scan a user's full hand history every time.
// Per-process only - would need a shared cache (e.g. Redis) if this app
// ever runs as more than one server instance.
const store = new Map();

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCached(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
