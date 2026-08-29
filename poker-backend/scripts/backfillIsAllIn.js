// One-off backfill: computes `isAllIn` and `allInEV` for every hand
// already in the database, for sessions imported before those fields
// existed. Both are pure functions of already-stored data (players[].stack
// + actions + holeCards/showedHand) - see allInDetector.js/
// evCalculator.js - so this is safe to re-run any time (idempotent).
// allInEV depends on isAllIn being set first, so both run together here
// rather than as two separate passes over the same hands.
//
// Not run automatically. Run manually with:
//   node poker-backend/scripts/backfillIsAllIn.js
// (requires MONGO_URI to be set, e.g. via poker-backend/.env)

import 'dotenv/config';
import mongoose from 'mongoose';
import Session from '../model/Session.js';
import { detectAllIn } from '../utils/allInDetector.js';
import { computeAllInEV } from '../utils/evCalculator.js';

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Backfilling isAllIn + allInEV...');

  let sessionsSeen = 0;
  let handsUpdated = 0;
  let handsAllIn = 0;
  let handsUnknown = 0;
  let handsWithEV = 0;

  const cursor = Session.find({}).cursor();
  for await (const session of cursor) {
    sessionsSeen++;
    let changed = false;

    for (const hand of session.hands) {
      const result = detectAllIn(hand);
      hand.allInEV = computeAllInEV(hand);
      changed = true;
      handsUpdated++;
      if (result === true) handsAllIn++;
      if (result === null) handsUnknown++;
      if (hand.allInEV !== null) handsWithEV++;
    }

    if (changed) {
      session.markModified('hands');
      await session.save();
    }

    if (sessionsSeen % 100 === 0) console.log(`...${sessionsSeen} sessions processed`);
  }

  console.log(`Done. ${sessionsSeen} sessions, ${handsUpdated} hands updated (${handsAllIn} all-in, ${handsUnknown} unknown, ${handsWithEV} with allInEV computed).`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
