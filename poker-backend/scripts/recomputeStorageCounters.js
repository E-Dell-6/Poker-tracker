// One-off repair: re-measures User.storageBytes and User.totalHands from the
// sessions actually in the database.
//
// Those two fields are running counters, $inc'd at import
// (handImportPipeline.js) and $inc'd back on delete (sessionService.js), which
// means they only ever reflect writes that happened while the counters existed.
// Sessions imported before then contributed nothing, so an older account reads
// low - or reads 0 despite a full library. Now that GET /api/user/storage shows
// these numbers to the user, that drift is visible, hence this pass.
//
// Recomputing is safe to re-run: it derives both values from the session
// documents themselves (BSON size, the same measure the import path uses) and
// $sets them, rather than adjusting by a delta.
//
// Dry run by default - prints what it would change and writes nothing:
//   node poker-backend/scripts/recomputeStorageCounters.js
// Apply:
//   node poker-backend/scripts/recomputeStorageCounters.js --apply
// (requires MONGO_URI to be set, e.g. via poker-backend/.env)

import 'dotenv/config';
import mongoose from 'mongoose';
import { BSON } from 'bson';
import Session from '../model/Session.js';
import UserModel from '../model/User.js';

const APPLY = process.argv.includes('--apply');

function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n, u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${parseFloat(v.toFixed(u === 0 ? 0 : 2))} ${units[u]}`;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? 'Connected. Applying...' : 'Connected. DRY RUN (pass --apply to write).');

  const users = await UserModel.find({}).select('name storageBytes totalHands').lean();
  let changed = 0;

  for (const user of users) {
    let bytes = 0;
    let hands = 0;

    // Stream the user's sessions rather than loading them all: hands are
    // embedded, so one session can be megabytes.
    const cursor = Session.find({ userId: user._id }).cursor();
    for await (const session of cursor) {
      // Measure the same way the import path does, so a recomputed total and
      // a freshly-imported one stay comparable.
      bytes += BSON.calculateObjectSize(session.toObject());
      hands += session.totalHands || session.hands?.length || 0;
    }

    const wasBytes = user.storageBytes ?? 0;
    const wasHands = user.totalHands ?? 0;
    if (wasBytes === bytes && wasHands === hands) continue;

    changed++;
    console.log(
      `${String(user.name).slice(0, 20).padEnd(20)} ` +
      `bytes ${fmtBytes(wasBytes)} -> ${fmtBytes(bytes)}   ` +
      `hands ${wasHands} -> ${hands}`
    );

    if (APPLY) {
      await UserModel.updateOne(
        { _id: user._id },
        { $set: { storageBytes: bytes, totalHands: hands } }
      );
    }
  }

  console.log(
    changed === 0
      ? 'All counters already accurate.'
      : APPLY ? `Updated ${changed} user(s).` : `${changed} user(s) would change. Re-run with --apply.`
  );

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
