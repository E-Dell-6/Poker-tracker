import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Session from '../model/Session.js';
import Person from '../model/People.js';
import HandLedger from '../model/HandLedger.js';
import ImportJob from '../model/ImportJob.js';
import SharedHand from '../model/sharedHand.js';
import RevokedToken from '../model/RevokedToken.js';

// One-off index build. Run this deliberately rather than letting Mongoose
// autoIndex do it on boot: these are built against a live collection and
// the Session ones in particular walk every embedded hand, so it should be
// a decision, not a side effect of a deploy.
//
//   node scripts/ensureIndexes.js
//
// Safe to re-run - createIndexes is a no-op for indexes that already exist.
//
// The HandLedger unique index is the one that can FAIL on real data: if
// duplicate {userId, handId} rows somehow exist, the build is rejected.
// That would mean the same hand was recorded twice, which is exactly what
// the index is there to prevent, so the right response is to investigate
// rather than to force it.

const MODELS = [
  ['Session', Session],
  ['Person', Person],
  ['HandLedger', HandLedger],
  ['ImportJob', ImportJob],
  // The TTL index here is the one that expires public share links, so a
  // deployment missing it leaves those links live forever.
  ['SharedHand', SharedHand],
  // Two load-bearing indexes. The unique one on jti is what makes logout
  // idempotent; the TTL on expiresAt is what stops the denylist growing
  // without bound. Missing them, the per-request revocation lookup in
  // userAuth degrades to a collection scan and nothing is ever cleaned up.
  ['RevokedToken', RevokedToken],
];

async function main() {
  await connectDB();

  for (const [name, model] of MODELS) {
    process.stdout.write(`Building indexes for ${name}... `);
    try {
      await model.createIndexes({ background: true });
      const indexes = await model.collection.indexes();
      console.log(`ok (${indexes.length} total)`);
      for (const idx of indexes) {
        const ttl = idx.expireAfterSeconds !== undefined ? ` [ttl ${idx.expireAfterSeconds}s]` : '';
        console.log(`    ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? ' [unique]' : ''}${ttl}`);
      }
    } catch (err) {
      console.log('FAILED');
      console.error(`  ${err.message}`);
      if (err.code === 11000) {
        console.error('  Duplicate keys exist - resolve them before retrying.');
      }
      process.exitCode = 1;
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
