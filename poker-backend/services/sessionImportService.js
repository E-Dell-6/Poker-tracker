import mongoose from 'mongoose';
import crypto from 'crypto';
import Session from '../model/Session.js';
import LiveSession from '../model/LiveSession.js';
import { parsePokerLog } from '../utils/parsePokerLog.js';
import { attachPersonIdsToHands } from './personService.js';
import { recomputeStatsForNewHands } from './statsService.js';
import { computeEffectiveStacks } from '../utils/effectiveStackCalculator.js';

// currency per parser format; add new sites here + Session schema enum
export const FORMAT_CURRENCY = {
  ACR: 'USD',
  GGPOKER: 'CAD',
  POKERNOW: 'CHIPS',
};

// Each file is processed independently so one duplicate/bad file in the
// batch doesn't block the rest - every failure is caught inside the loop
// and turned into a per-file result entry, not a request-level error.
export async function processUpload(userId, files) {
  const results = [];

  for (const file of files) {
    const filename = file.originalname;
    try {
      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const existing = await Session.findOne({ userId, fileHash });
      if (existing) {
        results.push({ filename, success: false, duplicate: true, error: "This log file has already been uploaded." });
        continue;
      }

      const fileContent = file.buffer.toString('utf8');

      let format, parsedHands;
      try {
        ({ format, hands: parsedHands } = parsePokerLog(fileContent));
      } catch (parseError) {
        results.push({ filename, success: false, error: parseError.message });
        continue;
      }

      if (parsedHands.length === 0) {
        results.push({ filename, success: false, error: "No hands found in the uploaded file" });
        continue;
      }
      parsedHands.forEach(hand => { if (!hand._id) hand._id = new mongoose.Types.ObjectId(); });

      // Currency isn't known to the parser itself (ACR/GGPoker log dollar
      // amounts in cents, PokerNow in play chips - see FORMAT_CURRENCY
      // above) - it's only resolved here, from the upload format.
      // computeEffectiveStacks needs it to convert stack sizes into bb
      // units correctly, so it has to run here rather than inside the
      // parser, using a shallow copy that carries `currency` without
      // persisting it on the hand doc itself (HandSchema has no `currency`
      // field - see statsService.js's extractHands for why that's
      // per-Session).
      const currency = FORMAT_CURRENCY[format] ?? 'CHIPS';
      parsedHands.forEach(hand => computeEffectiveStacks({ ...hand, currency }));

      // Every named player gets a Person record (auto-created on first
      // sight, reused after) so stats can be tracked without requiring a
      // manual "map this player" step first.
      await attachPersonIdsToHands(userId, parsedHands);

      const session = new Session({
        userId,
        fileHash,
        sessionType: 'upload',
        source: format,
        currency,
        date: parsedHands[0].datePlayed,
        // Same "2 players seated = Heads-Up" override the old list route
        // used to compute on every read; decided once here instead so the
        // session list doesn't need `hands` at all.
        gameType: parsedHands[0].players?.length === 2 ? 'Heads-Up' : parsedHands[0].gameType,
        totalHands: parsedHands.length,
        totalProfit: parsedHands.reduce((sum, h) => {
          const hero = h.players?.find(p => p.isHero);
          return sum + (hero?.profitLoss || 0);
        }, 0),
        hands: parsedHands
      });
      await session.save();

      // Fire-and-forget: don't block the upload response on stats
      // recomputation, but do log failures instead of swallowing them.
      // Deliberately detached from this function's own promise chain -
      // never awaited, keeps its own .catch (an unhandled rejection here
      // would crash the process, not just fail this request).
      recomputeStatsForNewHands(userId, parsedHands).catch(err => {
        console.error(`Stats recompute failed for session ${session._id}:`, err);
      });

      results.push({ filename, success: true, sessionId: session._id, totalHands: parsedHands.length, source: format });
    } catch (fileError) {
      results.push({ filename, success: false, error: fileError.message });
    }
  }

  return results;
}

// Creates a LiveSession doc (not a Session, despite living under the
// sessions import service) - relocated verbatim from the old POST /sessions
// handler for behavior preservation. This looks like unused/legacy code:
// the current frontend's live-session flow goes through
// liveSessionController.js's clock-in/clock-out instead, and nothing in
// api/sessions.js on the frontend calls a bare POST /api/sessions. Worth a
// separate removal decision - not dropped here.
export async function createLegacySessionViaUploadPath(userId, {
  clockInTime, clockOutTime, smallBlind, bigBlind, buyIns, totalBuyIn, cashOut, profit, gameType
}) {
  if (!clockInTime || !clockOutTime || cashOut === undefined || !buyIns?.length) {
    return { error: 'missing-fields' };
  }
  const session = new LiveSession({
    userId,
    date: new Date(clockInTime),
    clockInTime: new Date(clockInTime),
    clockOutTime: new Date(clockOutTime),
    smallBlind: Number(smallBlind),
    bigBlind: Number(bigBlind),
    buyIns: buyIns.map(Number),
    totalBuyIn: Number(totalBuyIn),
    cashOut: Number(cashOut),
    totalProfit: Number(profit),
    gameType: gameType || 'Cash Game',
  });
  await session.save();
  return { session };
}
