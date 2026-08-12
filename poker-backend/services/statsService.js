import Hand from '../model/PokerHands.js';
import PlayerStats from '../model/PlayerStats.js';
import { computeStatsForHands, matchByPersonId, matchHero } from '../utils/statsEngine.js';

export async function recomputeStatsForPerson(userId, personId) {
  const hands = await Hand.find({ 'players.personId': personId }).lean();
  const stats = computeStatsForHands(hands, matchByPersonId(personId));

  return PlayerStats.findOneAndUpdate(
    { userId, personId },
    { ...stats, userId, personId, isHero: false, lastComputedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function recomputeHeroStats(userId, sessionIds) {
  const hands = await Hand.find({
    sessionId: { $in: sessionIds },
    'players.isHero': true
  }).lean();
  const stats = computeStatsForHands(hands, matchHero());

  return PlayerStats.findOneAndUpdate(
    { userId, isHero: true },
    { ...stats, userId, personId: null, isHero: true, lastComputedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Call this right after a hand (or batch of hands, e.g. a parsed session) is
// saved. It figures out which linked persons + hero appear in the new hands
// and recomputes just those — not every person the user has ever tracked.
export async function recomputeStatsForNewHands(userId, hands, sessionIds) {
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
  if (touchesHero) jobs.push(recomputeHeroStats(userId, sessionIds));

  return Promise.all(jobs);
}