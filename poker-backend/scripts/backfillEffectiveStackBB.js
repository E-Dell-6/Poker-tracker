// One-off backfill: computes `players[].effectiveStackBB` for every hand
// already in the database, for sessions imported before that field existed.
// Pure function of already-stored data (stack, stakes, Session.currency) -
// see effectiveStackCalculator.js - so this is safe to re-run any time
// (idempotent) and never needs to guess at anything.
//
// Not run automatically. Run manually with:
//   node poker-backend/scripts/backfillEffectiveStackBB.js
// (requires MONGO_URI to be set, e.g. via poker-backend/.env)

import 'dotenv/config';
import mongoose from 'mongoose';
import Session from '../model/Session.js';
import { computeEffectiveStacks } from '../utils/effectiveStackCalculator.js';

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Backfilling effectiveStackBB...');

  let sessionsSeen = 0;
  let handsUpdated = 0;

  const cursor = Session.find({}).cursor();
  for await (const session of cursor) {
    sessionsSeen++;
    let changed = false;

    for (const hand of session.hands) {
      // computeEffectiveStacks reads hand.currency (a Session-level field,
      // not stored per-hand - see sessionRoute.js's POST /upload for why)
      // and mutates `players` in place - pass the live subdocument array
      // itself (not a toObject() copy) so mutations persist on save().
      computeEffectiveStacks({ stakes: hand.stakes, currency: session.currency, players: hand.players });
      changed = true;
      handsUpdated++;
    }

    if (changed) {
      session.markModified('hands');
      await session.save();
    }

    if (sessionsSeen % 100 === 0) console.log(`...${sessionsSeen} sessions processed`);
  }

  console.log(`Done. ${sessionsSeen} sessions, ${handsUpdated} hands updated.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
