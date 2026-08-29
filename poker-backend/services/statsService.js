import Session from '../model/Session.js';
import PlayerStats from '../model/PlayerStats.js';
import { computeStatsForHands, matchByPersonId, matchHero } from '../utils/statsEngine.js';
import { CENTS_CURRENCIES } from '../utils/blinds.js';

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

// Call this right after a session (a batch of parsed hands) is saved. It
// looks at just the newly-saved hands to figure out which linked persons +
// hero are affected, then recomputes only those - not everyone ever tracked.
export async function recomputeStatsForNewHands(userId, hands) {
  const personIds = new Set();
  let touchesHero = false;

  for (const hand of hands) {
    for (const p of hand.players || []) {
      if (p.isSittingOut) continue;
      if (p.personId) personIds.add(String(p.personId));
      if (p.isHero) touchesHero = true;
    }
  }

  const jobs = [...personIds].map(pid => recomputeStatsForPerson(userId, pid));
  if (touchesHero) jobs.push(recomputeHeroStats(userId));

  return Promise.all(jobs);
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

export async function getHeroEvGraph(userId) {
  const sessions = await Session.find({ userId, 'hands.players.isHero': true })
    .select('date currency hands')
    .lean();

  return buildEvGraphRows(sessions);
}