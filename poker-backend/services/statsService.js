import Session from '../model/Session.js';
import PlayerStats from '../model/PlayerStats.js';
import { computeStatsForHands, matchByPersonId, matchHero } from '../utils/statsEngine.js';
import { CENTS_CURRENCIES } from '../utils/blinds.js';
import { getCached, setCached } from '../utils/statsCache.js';

const FILTERED_STATS_TTL_MS = 60_000;

// Each hand needs to know which currency its dollar amounts (profitLoss,
// stakes, etc.) are logged in, but that lives on the parent Session, not
// on the hand doc itself - so it's stamped on here before hands are
// flattened out of their sessions and lose that context. statsEngine.js
// relies on this to convert bb-size and profitLoss into matching units.
function extractHands(sessions) {
  return sessions.flatMap(s => (s.hands || []).map(h => ({ ...h, currency: s.currency })));
}

export async function recomputeStatsForPerson(userId, personId) {
  const sessions = await Session.find({ userId, 'hands.players.personId': personId }).lean();
  const hands = extractHands(sessions);
  const stats = computeStatsForHands(hands, matchByPersonId(personId));

  return PlayerStats.findOneAndUpdate(
    { userId, personId },
    { ...stats, userId, personId, isHero: false, lastComputedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function recomputeHeroStats(userId) {
  const sessions = await Session.find({ userId, 'hands.players.isHero': true }).lean();
  const hands = extractHands(sessions);
  const stats = computeStatsForHands(hands, matchHero());

  return PlayerStats.findOneAndUpdate(
    { userId, isHero: true },
    { ...stats, userId, personId: null, isHero: true, lastComputedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Pure filter over already-fetched hands: `stakes` exact-matches
// hand.stakes, `from`/`to` bound hand.datePlayed. Every field is optional -
// omitting all three is a no-op pass-through. Shared by
// computeFilteredHeroStats (flattened hands) and getHeroEvGraph (each
// session's own .hands array) below - it only ever touches
// .stakes/.datePlayed, so it works on either shape.
export function filterHands(hands, { stakes, from, to } = {}) {
  return hands.filter(h => {
    if (stakes && h.stakes !== stakes) return false;
    if (from && new Date(h.datePlayed) < new Date(from)) return false;
    if (to && new Date(h.datePlayed) > new Date(to)) return false;
    return true;
  });
}

// Live-filtered counterpart to recomputeHeroStats, for the Study page's
// Stakes/Time filter: same query + same computeStatsForHands pipeline (so
// the response shape is identical to GET /me), just over a narrowed hand
// set and never persisted to PlayerStats - this is an ephemeral view, not
// the cached doc /me serves. Filtering can't be pushed down to the Mongo
// query (hands are embedded sub-documents with no per-hand index), so a
// repeated filter combo is cached briefly instead of re-scanning every time.
export async function computeFilteredHeroStats(userId, filters = {}) {
  const cacheKey = `hero:${userId}:${filters.stakes || ''}:${filters.from || ''}:${filters.to || ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const sessions = await Session.find({ userId, 'hands.players.isHero': true }).lean();
  const hands = filterHands(extractHands(sessions), filters);
  const stats = computeStatsForHands(hands, matchHero());

  setCached(cacheKey, stats, FILTERED_STATS_TTL_MS);
  return stats;
}

// Computes and persists one person's stats from hands ALREADY in memory.
// Split out of recomputeStatsForPerson so the batch path below can supply
// its own hands instead of issuing a query per person.
async function persistPersonStats(userId, personId, hands) {
  const stats = computeStatsForHands(hands, matchByPersonId(personId));
  return PlayerStats.findOneAndUpdate(
    { userId, personId },
    { ...stats, userId, personId, isHero: false, lastComputedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

// Call this ONCE after a batch of files has been imported, with the union
// of the person ids they touched.
//
// The naive version of this - loop the ids, call recomputeStatsForPerson
// on each - is O(persons x all hands) in BOTH queries and CPU, because
// every call re-queries the user's sessions and then walks every hand in
// them looking for one person. Measured on a 20k-hand import with 400
// distinct opponents that was ~0.8 persons/second: over eight minutes of
// pegged CPU, running after the import had already reported itself done.
//
// So instead: read the sessions ONCE, bucket each hand under the people it
// actually involves in a single pass, then compute each person's stats
// from their own (much smaller) bucket. Same results - computeStatsForHands
// only ever looks at hands where its matcher finds a player, so giving it
// exactly those hands is equivalent to giving it all of them - at roughly
// 1/(number of persons) of the work.
//
// A cursor rather than a find().lean() array, and hands are retained only
// if they involve someone being recomputed, so a job touching a handful of
// people doesn't hold the user's entire history in memory.
export async function recomputeStatsForPersonIds(userId, personIds, touchesHero) {
  const wanted = new Set([...personIds].map(String));
  if (wanted.size === 0 && !touchesHero) return [];

  const byPerson = new Map();
  const heroHands = [];

  const cursor = Session.find({ userId }).lean().cursor();
  for await (const session of cursor) {
    for (const hand of session.hands || []) {
      // extractHands' job, inlined: each hand needs its parent session's
      // currency, which statsEngine uses to reconcile bb-size against
      // profitLoss units.
      let stamped = null;
      const stamp = () => (stamped ??= { ...hand, currency: session.currency });

      let heroSeen = false;
      for (const player of hand.players || []) {
        if (player.isHero) {
          if (!heroSeen) { heroHands.push(stamp()); heroSeen = true; }
          continue;
        }
        const pid = player.personId && String(player.personId);
        if (!pid || !wanted.has(pid)) continue;
        let bucket = byPerson.get(pid);
        if (!bucket) byPerson.set(pid, (bucket = []));
        bucket.push(stamp());
      }
    }
  }

  const results = [];
  for (const pid of wanted) {
    results.push(await persistPersonStats(userId, pid, byPerson.get(pid) || []));
    // Pure CPU from here on, so nothing else yields on its own. Without
    // this the whole batch blocks the event loop for every other request.
    await yieldToEventLoop();
  }

  if (touchesHero) {
    const stats = computeStatsForHands(heroHands, matchHero());
    results.push(await PlayerStats.findOneAndUpdate(
      { userId, isHero: true },
      { ...stats, userId, personId: null, isHero: true, lastComputedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ));
  }

  return results;
}

// Chronological hero hand-by-hand profit vs. all-in EV, for the item 4e
// graph: [{ handIndex, actualResult, cumulativeActual, evResult,
// cumulativeEV }]. `handIndex` here is hero's sequence position across
// every tracked hand (0, 1, 2, ...) - NOT hand.handIndex, which resets to
// 1 at the start of every session and would collide across sessions on a
// shared x-axis. evResult falls back to actualResult whenever allInEV is
// null (every non-all-in hand, and all-in hands evCalculator.js couldn't
// compute - see its module comment) - those hands contribute no variance
// information to the EV line, which is the correct behavior, not a gap.
//
// Each hand's profitLoss/allInEV is normalized to major units using ITS
// OWN session's currency (not one global currency the way statsEngine.js's
// totalProfitLoss requires) - a user mixing real-money and play-chip
// sessions still gets a continuous graph, at the cost of summing two unit
// systems together across the mix, same caveat Profile.jsx's chart
// already carries (see its onlineSessionProfit comment).
//
// Pure function over already-fetched sessions (mirrors statsEngine.js's
// computeStatsForHands taking pre-fetched hands) - kept separate from the
// DB query below so it's testable without a live Mongo connection.
export function buildEvGraphRows(sessions) {
  const sortedSessions = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));

  const rows = [];
  let cumulativeActual = 0;
  let cumulativeEV = 0;
  let handIndex = 0;

  for (const session of sortedSessions) {
    const toMajor = v => (CENTS_CURRENCIES.has(session.currency) ? v / 100 : v);
    const hands = [...(session.hands || [])].sort((a, b) => a.handIndex - b.handIndex);

    for (const hand of hands) {
      const hero = (hand.players || []).find(p => p.isHero);
      if (!hero || typeof hero.profitLoss !== 'number') continue;

      const actualResult = toMajor(hero.profitLoss);
      const evResult = toMajor(hand.allInEV ?? hero.profitLoss);
      cumulativeActual += actualResult;
      cumulativeEV += evResult;

      rows.push({
        handIndex: handIndex++,
        actualResult: Math.round(actualResult * 100) / 100,
        cumulativeActual: Math.round(cumulativeActual * 100) / 100,
        evResult: Math.round(evResult * 100) / 100,
        cumulativeEV: Math.round(cumulativeEV * 100) / 100
      });
    }
  }

  return rows;
}

// `filters` is the same { stakes, from, to } shape computeFilteredHeroStats
// takes - applied per-session (buildEvGraphRows expects a `sessions` array
// with each session's own `.hands`, not a flat hand list) via the same
// filterHands() so the Board tab's EV graph respects the Study page's
// Stakes/Time filter too. Same short-TTL cache as computeFilteredHeroStats.
export async function getHeroEvGraph(userId, filters = {}) {
  const cacheKey = `ev:${userId}:${filters.stakes || ''}:${filters.from || ''}:${filters.to || ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const sessions = await Session.find({ userId, 'hands.players.isHero': true })
    .select('date currency hands')
    .lean();

  const filteredSessions = sessions.map(s => ({ ...s, hands: filterHands(s.hands || [], filters) }));
  const rows = buildEvGraphRows(filteredSessions);

  setCached(cacheKey, rows, FILTERED_STATS_TTL_MS);
  return rows;
}