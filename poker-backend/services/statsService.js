import Session from '../model/Session.js';
import PlayerStats from '../model/PlayerStats.js';
import { computeStatsForHands, matchByPersonId, matchHero } from '../utils/statsEngine.js';

function extractHands(sessions) {
  return sessions.flatMap(s => s.hands || []);
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