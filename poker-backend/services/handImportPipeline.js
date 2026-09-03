import mongoose from 'mongoose';
import crypto from 'crypto';
import { BSON } from 'mongodb';
import Session from '../model/Session.js';
import HandLedger from '../model/HandLedger.js';
import UserModel from '../model/User.js';
import { parsePokerLog } from '../utils/parsePokerLog.js';
import { computeEffectiveStacks } from '../utils/effectiveStackCalculator.js';
import { computeAllInEV } from '../utils/evCalculator.js';
import { FORMAT_CURRENCY } from '../config/formats.js';
import { PROCESSING } from '../config/limits.js';

// The per-file import pipeline, shared by both callers: the inline
// POST /api/upload path (sessionImportService.processUpload) and the
// staged bulk-import runner (importRunner). Keeping it in one place means
// dedup, EV, and quota accounting can't drift between a 1-file upload and
// a 500-file folder.
//
// Deliberately does NOT recompute stats. Both callers accumulate the
// personIds this returns and run a single coalesced recompute once, after
// every file - the old per-file fire-and-forget call was launching
// thousands of overlapping full-history scans during a folder import.

const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

// All-in EV, extracted from the parsers so it can yield.
//
// This is the CPU-heavy part of an import: computeAllInEV returns
// immediately for the ~97% of hands with no all-in, but a preflop all-in
// runs PROCESSING.EQUITY_TRIALS Monte Carlo trials, each evaluating all
// C(7,5)=21 five-card subsets per player - on the order of 210k
// evaluations for a single hand. Node is single-threaded and mongod shares
// this box's 1-2 cores, so without the await below one import freezes
// every other request for the duration.
export async function computeEvWithYields(hands, onProgress) {
  let sinceYield = 0;

  for (let i = 0; i < hands.length; i++) {
    const ev = computeAllInEV(hands[i]);
    hands[i].allInEV = ev;

    // Yield after every hand that actually computed equity, not on a fixed
    // hand interval. Cost per hand is wildly bimodal: computeAllInEV
    // returns null immediately for the ~95% of hands with no all-in, while
    // a preflop all-in runs thousands of Monte Carlo trials. Yielding every
    // N hands therefore let N *expensive* hands run back to back - measured
    // at over 5 seconds of p95 request latency on an all-in-heavy import.
    // Keying on "did this hand do real work" bounds uninterrupted blocking
    // to a single equity computation instead.
    sinceYield++;
    if (ev !== null || sinceYield >= PROCESSING.YIELD_EVERY_N_HANDS) {
      await yieldToEventLoop();
      sinceYield = 0;
    }

    if ((i + 1) % PROCESSING.PROGRESS_EVERY_N_HANDS === 0) {
      await onProgress?.(i + 1);
    }
  }
}

// Splits hands into those this user hasn't imported before and those they
// have, using the flat HandLedger collection.
//
// Read-only on purpose. An earlier version claimed the ids with an
// insertMany here and read the E11000 collisions to learn which hands were
// duplicates - one round trip instead of two, but it wrote the "I have this
// hand" marker BEFORE the hand was durable. A crash in between (verified
// with kill -9 mid-import) left ledger rows pointing at a session that was
// never saved, and because those rows say the hands exist, the hands could
// never be imported again. The catch block that was meant to release them
// can't run on SIGKILL.
//
// So the claim now happens after the session is saved (see claimHandIds),
// and this is just a lookup. The unique {userId, handId} index makes it a
// covered query.
//
// Hands with no handId (every PokerNow hand - that format has no site hand
// id) are always treated as new; whole-file SHA-256 remains their only
// dedup.
const LOOKUP_CHUNK = 1000;

export async function partitionAlreadyImported(userId, hands) {
  const withId = hands.filter(h => h.handId);
  if (withId.length === 0) return { fresh: hands, duplicateCount: 0 };

  const alreadyHave = new Set();
  const ids = withId.map(h => h.handId);
  // Chunked so a single big file doesn't build a $in with thousands of
  // terms.
  for (let i = 0; i < ids.length; i += LOOKUP_CHUNK) {
    const rows = await HandLedger.find({ userId, handId: { $in: ids.slice(i, i + LOOKUP_CHUNK) } })
      .select('handId')
      .lean();
    for (const row of rows) alreadyHave.add(row.handId);
  }

  if (alreadyHave.size === 0) return { fresh: hands, duplicateCount: 0 };

  return {
    fresh: hands.filter(h => !h.handId || !alreadyHave.has(h.handId)),
    duplicateCount: alreadyHave.size,
  };
}

// Records that these hands are now stored, AFTER the session holding them
// has been saved. Ordering matters: if this never runs because the process
// died, the hands are still safely in the session and the only cost is
// that a later overlapping import could re-add them. Session.ledgerWritten
// marks that gap so it can be repaired at boot (see backfillMissingLedger).
export async function claimHandIds(userId, hands, sessionId) {
  const rows = hands
    .filter(h => h.handId)
    .map(h => ({ userId, handId: h.handId, sessionId }));
  if (rows.length === 0) return;

  try {
    await HandLedger.insertMany(rows, { ordered: false });
  } catch (err) {
    // A duplicate here is benign - it means the id was already recorded,
    // which is the state we wanted. Anything else is a real failure.
    const writeErrors = err?.writeErrors || err?.result?.result?.writeErrors || [];
    const onlyDuplicates = writeErrors.length > 0 &&
      writeErrors.every(we => (we.code ?? we.err?.code) === 11000);
    if (!onlyDuplicates && err?.code !== 11000) throw err;
  }
}

// Boot repair for the crash window described above: a session was saved but
// its ledger rows never were. Without this, hands in such a session aren't
// protected from being imported a second time by an overlapping export.
export async function backfillMissingLedger() {
  const stranded = await Session.find({ ledgerWritten: false })
    .select('_id userId hands.handId')
    .lean();

  for (const session of stranded) {
    try {
      await claimHandIds(session.userId, session.hands || [], session._id);
      await Session.updateOne({ _id: session._id }, { $set: { ledgerWritten: true } });
      console.log(`[import] backfilled hand ledger for session ${session._id}`);
    } catch (err) {
      console.error(`[import] ledger backfill failed for session ${session._id}:`, err.message);
    }
  }
  return stranded.length;
}

/**
 * Imports one hand-history file. Returns a per-file result in the same
 * shape processUpload has always produced, plus `personIds` /
 * `touchesHero` for the caller's coalesced stats recompute.
 *
 * `resolver` is a personResolver created ONCE per batch/job - passing a
 * fresh one per file would defeat its purpose.
 */
export async function importOneFile({ userId, buffer, filename, resolver, onProgress }) {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const existing = await Session.findOne({ userId, fileHash }).select('_id').lean();
  if (existing) {
    return { filename, success: false, duplicate: true, error: 'This log file has already been uploaded.' };
  }

  let format, parsedHands;
  try {
    // EV is skipped here and run below with yields - see
    // computeEvWithYields for why it can't stay inside the parser.
    ({ format, hands: parsedHands } = parsePokerLog(buffer.toString('utf8'), { computeEv: false }));
  } catch (parseError) {
    return { filename, success: false, error: parseError.message };
  }

  if (parsedHands.length === 0) {
    return { filename, success: false, error: 'No hands found in the uploaded file' };
  }

  parsedHands.forEach(hand => { if (!hand._id) hand._id = new mongoose.Types.ObjectId(); });

  // Currency isn't known to the parser itself (ACR/GGPoker log dollar
  // amounts in cents, PokerNow in play chips), so it's resolved from the
  // detected format here, and computeEffectiveStacks needs it to convert
  // stacks into bb units. Shallow copy carries `currency` without
  // persisting it on the hand doc - HandSchema has no such field.
  const currency = FORMAT_CURRENCY[format] ?? 'CHIPS';
  parsedHands.forEach(hand => computeEffectiveStacks({ ...hand, currency }));

  const { fresh, duplicateCount } = await partitionAlreadyImported(userId, parsedHands);

  if (fresh.length === 0) {
    return {
      filename, success: false, duplicate: true,
      handsSkipped: duplicateCount,
      error: `Every hand in this file was already imported (${duplicateCount} hands).`,
    };
  }

  {
    // handIndex is a per-session 1..n sequence the UI relies on, so it has
    // to be reassigned after dedup removed hands from the middle.
    fresh.forEach((hand, i) => { hand.handIndex = i + 1; });

    await computeEvWithYields(fresh, onProgress);
    // GGPoker's parser already replaces opponent names with per-hand seat
    // labels (see anonymizeNonHeroNames in GGPokerParser.js) so no
    // persistent identifier survives - linking those labels to a Person
    // here would just merge unrelated GGPoker opponents who happened to
    // sit in the same seat number across different files.
    if (format !== 'GGPOKER') {
      await resolver.attach(fresh);
    }

    const session = new Session({
      userId,
      fileHash,
      sessionType: 'upload',
      source: format,
      currency,
      date: fresh[0].datePlayed,
      // Same "2 players seated = Heads-Up" override the old list route
      // computed on every read; decided once here instead.
      gameType: fresh[0].players?.length === 2 ? 'Heads-Up' : fresh[0].gameType,
      totalHands: fresh.length,
      totalProfit: fresh.reduce((sum, h) => {
        const hero = h.players?.find(p => p.isHero);
        return sum + (hero?.profitLoss || 0);
      }, 0),
      hands: fresh,
      // Flipped to true once the ledger rows land. A session left false is
      // the crash window, repaired by backfillMissingLedger at boot.
      ledgerWritten: false,
    });

    // Hands are embedded, so a session is one document against Mongo's
    // hard 16MB ceiling. Check before saving so an oversized file gets an
    // explanation instead of a raw driver error.
    const bsonSize = BSON.calculateObjectSize(session.toObject());
    if (bsonSize > PROCESSING.MAX_SESSION_BSON_BYTES) {
      throw new Error(
        `This file is too large to store as a single session ` +
        `(${fresh.length} hands, ${(bsonSize / 1024 / 1024).toFixed(1)}MB of ${(PROCESSING.MAX_SESSION_BSON_BYTES / 1024 / 1024).toFixed(0)}MB). ` +
        `Split the export into smaller files and re-import.`
      );
    }

    await session.save();

    // Only now that the hands are durable is it safe to record that this
    // user has them.
    await claimHandIds(userId, fresh, session._id);
    await Session.updateOne({ _id: session._id }, { $set: { ledgerWritten: true } });

    // Quota accounting. Approximating stored bytes with the BSON size is
    // deliberate - it's what the document actually costs on disk, and it
    // avoids a separate aggregation on every quota check.
    await UserModel.updateOne(
      { _id: userId },
      { $inc: { storageBytes: bsonSize, totalHands: fresh.length } }
    );

    const personIds = new Set();
    let touchesHero = false;
    for (const hand of fresh) {
      for (const p of hand.players || []) {
        if (p.isSittingOut) continue;
        if (p.personId) personIds.add(String(p.personId));
        if (p.isHero) touchesHero = true;
      }
    }

    return {
      filename, success: true, sessionId: session._id, source: format,
      totalHands: fresh.length,
      handsSkipped: duplicateCount,
      personIds, touchesHero,
    };
  }
}
