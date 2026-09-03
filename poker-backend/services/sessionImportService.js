import LiveSession from '../model/LiveSession.js';
import { importOneFile } from './handImportPipeline.js';
import { createPersonResolver } from './personResolver.js';
import { recomputeStatsForPersonIds } from './statsService.js';

export { FORMAT_CURRENCY } from '../config/formats.js';

// The inline upload path (POST /api/upload), for small uploads that fit
// comfortably in one request. Large folder imports go through
// /api/imports and services/importRunner.js instead, but both share
// handImportPipeline.importOneFile, so dedup, EV and quota behave
// identically either way.
//
// Each file is processed independently so one duplicate/bad file in the
// batch doesn't block the rest - every failure is caught inside the loop
// and turned into a per-file result entry, not a request-level error.
export async function processUpload(userId, files) {
  const results = [];

  // ONE resolver for the whole batch. It holds this user's Person set in
  // memory, so creating it per file would put back the N+1 it exists to
  // remove.
  const resolver = await createPersonResolver(userId);

  // Accumulated across every file, then recomputed once at the end. The
  // old code fired a detached recompute per file, which overlapped
  // full-history scans with the remaining files' parsing.
  const personIds = new Set();
  let touchesHero = false;

  for (const file of files) {
    try {
      const result = await importOneFile({
        userId,
        buffer: file.buffer,
        filename: file.originalname,
        resolver,
      });

      if (result.success) {
        result.personIds.forEach(id => personIds.add(id));
        touchesHero = touchesHero || result.touchesHero;
      }

      // personIds/touchesHero are the caller's bookkeeping, not part of
      // the per-file response contract the frontend reads.
      const { personIds: _p, touchesHero: _h, ...publicResult } = result;
      results.push(publicResult);
    } catch (fileError) {
      results.push({ filename: file.originalname, success: false, error: fileError.message });
    }
  }

  // Fire-and-forget: don't block the upload response on stats
  // recomputation, but do log failures instead of swallowing them.
  // Deliberately detached from this function's own promise chain - never
  // awaited, and it keeps its own .catch (an unhandled rejection here
  // would crash the process, not just fail this request).
  if (personIds.size > 0 || touchesHero) {
    recomputeStatsForPersonIds(userId, personIds, touchesHero).catch(err => {
      console.error(`Stats recompute failed after upload for user ${userId}:`, err);
    });
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
