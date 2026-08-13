import Person from '../model/People.js';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Case-insensitive match on (userId, name) so "AlexSexy" and "alexsexy"
// from different log exports resolve to the same Person. First-seen
// casing wins for the stored name.
export async function findOrCreatePerson(userId, name) {
  const trimmed = name.trim();
  let person = await Person.findOne({
    userId,
    name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i')
  });
  if (!person) {
    person = await Person.create({ userId, name: trimmed });
  }
  return person;
}

// Mutates each non-sitting-out, non-hero player in place, setting
// personId if it isn't already set. Already-linked players are left
// alone so a manual re-link isn't clobbered on re-import.
export async function attachPersonIds(userId, players) {
  for (const player of players) {
    if (player.isSittingOut || player.isHero || player.personId) continue;
    const person = await findOrCreatePerson(userId, player.name);
    player.personId = person._id;
  }
  return players;
}

export async function attachPersonIdsToHands(userId, hands) {
  for (const hand of hands) {
    await attachPersonIds(userId, hand.players);
  }
  return hands;
}