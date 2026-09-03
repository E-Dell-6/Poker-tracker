import Person from '../model/People.js';
import { QUOTA } from '../config/limits.js';

// Bulk replacement for personService.js's per-player findOrCreatePerson
// loop, for the one caller that does enough volume to care: bulk import.
//
// The old path ran one Person.findOne per non-hero player per hand - about
// 100k queries for a 20k-hand folder - and each was a case-insensitive
// RegExp against an unindexed `name` field, so every one was a collection
// scan. mongod runs on the same 1-2 cores as Node here, so those scans
// weren't just latency, they were CPU stolen from serving requests.
//
// This loads the user's Person set once per JOB (not per file), keeps it
// in a Map, and inserts only genuinely-new names in a single batch. ~100k
// queries becomes ~2 per job plus one insert per file that introduces new
// names.
//
// Matching semantics are deliberately identical to findOrCreatePerson:
// keyed on name.trim().toLowerCase() so "AlexSexy" and "alexsexy" from
// different exports resolve to one Person, with first-seen casing kept as
// the stored name. Players that are sitting out, are the hero, or already
// carry a personId are left untouched, so a manual re-link is never
// clobbered by a re-import.

function keyOf(name) {
  return String(name).trim().toLowerCase();
}

export async function createPersonResolver(userId) {
  const existing = await Person.find({ userId }).select('name').lean();

  const byKey = new Map();
  for (const person of existing) {
    // A pre-existing collection can already hold two casings of the same
    // name (nothing enforced uniqueness before). Keep the first, so this
    // resolves the same way findOrCreatePerson's findOne would have.
    const key = keyOf(person.name);
    if (!byKey.has(key)) byKey.set(key, person._id);
  }

  let createdThisJob = 0;

  return {
    get createdCount() { return createdThisJob; },

    // Mutates `hands` in place, setting player.personId. Returns nothing;
    // the hands are the output. Call once per file - the Map persists
    // across calls, which is the whole point.
    async attach(hands) {
      // Pass 1: collect names not already known. A Map keyed the same way
      // as byKey dedupes names that are new *within this batch* too, so a
      // player appearing in 500 hands is inserted once, not 500 times.
      const pendingByKey = new Map();
      for (const hand of hands) {
        for (const player of hand.players || []) {
          if (player.isSittingOut || player.isHero || player.personId) continue;
          if (player.name == null) continue;
          const key = keyOf(player.name);
          if (byKey.has(key) || pendingByKey.has(key)) continue;
          pendingByKey.set(key, String(player.name).trim());
        }
      }

      if (pendingByKey.size > 0) {
        if (createdThisJob + pendingByKey.size > QUOTA.NEW_PERSONS_PER_JOB) {
          // A log full of junk names would otherwise mint unbounded Person
          // docs, and every one of them becomes a row that later stats
          // recomputes have to walk.
          throw new Error(
            `This import would create ${createdThisJob + pendingByKey.size} new players, ` +
            `over the limit of ${QUOTA.NEW_PERSONS_PER_JOB}. This usually means the file ` +
            `isn't a hand history, or player names weren't parsed correctly.`
          );
        }

        const docs = [...pendingByKey.values()].map(name => ({ userId, name }));
        const inserted = await Person.insertMany(docs, { ordered: false });
        for (const person of inserted) {
          byKey.set(keyOf(person.name), person._id);
        }
        createdThisJob += inserted.length;
      }

      // Pass 2: every name is now in the Map, so this is pure assignment.
      for (const hand of hands) {
        for (const player of hand.players || []) {
          if (player.isSittingOut || player.isHero || player.personId) continue;
          if (player.name == null) continue;
          const id = byKey.get(keyOf(player.name));
          if (id) player.personId = id;
        }
      }
    },
  };
}
