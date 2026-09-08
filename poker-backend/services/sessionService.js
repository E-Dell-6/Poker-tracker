import mongoose from 'mongoose';
import Session from '../model/Session.js';
import { handMatchesFilter } from '../utils/handFilters.js';
import { getPositionMap } from '../utils/statsEngine.js';
import { CENTS_CURRENCIES, parseBigBlind } from '../utils/blinds.js';
import { classifyHoleCards } from '../utils/handClass.js';
import { BSON } from 'mongodb';
import HandLedger from '../model/HandLedger.js';
import UserModel from '../model/User.js';
import Person from '../model/People.js';
import { recomputeStatsForPerson } from './statsService.js';

// List view: deliberately excludes `hands` (each session can carry hundreds
// of nested hand documents - players/actions/board/etc). The history page
// only needs per-hand detail for whichever single session the user expands,
// so that's fetched separately via sessionHands() below. This keeps the
// list fast regardless of how much hand history a user has accumulated.
export async function list(userId) {
  return Session.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $addFields: {
        totalHands: {
          $ifNull: ["$totalHands", { $size: { $ifNull: ["$hands", []] } }]
        }
    }},
    { $project: { hands: 0 } },
    { $sort: { uploadDate: -1 } },
  ]);
}

// Paginated (page/limit, default 50, capped at 100) with optional
// gameType/starred/stakes filtering pushed into the same $match - both have
// to happen server-side together, not layered (filter server-side, then
// paginate client-side, or vice versa), or a filter would only ever see
// whichever page happened to already be loaded. A $facet computes the
// current page, the total row count, and a summary (hands/net-profit
// totals) across the *whole filtered set* in one round trip.
export async function listPaginated(userId, { page, limit, gameType, starred, stakes }) {
  const skip = (page - 1) * limit;

  const match = { userId: new mongoose.Types.ObjectId(userId) };
  if (gameType && gameType !== 'All') {
    match.gameType = gameType;
  }
  if (starred === 'true') {
    match.starred = true;
  }

  // totalProfit is stored in integer cents for USD/CAD sessions, plain
  // major units for CHIPS (see the Session schema comment) - same
  // distinction CENTS_CURRENCIES already encodes for bb-size scaling
  // elsewhere (statsService.js), reused here instead of a second
  // hardcoded currency list.
  const normalizedProfit = {
    $cond: [{ $in: ['$currency', Array.from(CENTS_CURRENCIES)] }, { $divide: ['$totalProfit', 100] }, '$totalProfit']
  };

  // totalHands is only stamped onto sessions created via the upload path
  // after this field was introduced - older sessions in the DB never got
  // it set. Rather than requiring a one-off backfill migration, fall back
  // to computing it from hands.length server-side ($size), so it
  // self-heals for any session regardless of when it was created. hands
  // itself is still dropped before the doc leaves Mongo either way.
  //
  // Stakes has no stored session-level field (only each individual hand
  // carries its own `stakes` string) - a session is always one continuous
  // sit at one stakes level in practice, so the first hand's stakes stands
  // in for the whole session, same "derive once, don't require a
  // migration" approach as totalHands above.
  const stakesFilter = stakes ? [{ $match: { stakes } }] : [];
  const [result] = await Session.aggregate([
    { $match: match },
    { $addFields: {
        totalHands: {
          $ifNull: ["$totalHands", { $size: { $ifNull: ["$hands", []] } }]
        },
        stakes: { $arrayElemAt: ['$hands.stakes', 0] }
    }},
    ...stakesFilter,
    { $project: { hands: 0 } },
    { $sort: { uploadDate: -1 } },
    { $facet: {
        sessions: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
        summary: [{ $group: {
          _id: null,
          totalHands: { $sum: '$totalHands' },
          netProfit: { $sum: normalizedProfit },
          currencies: { $addToSet: '$currency' }
        } }]
    } }
  ]);

  const total = result.totalCount[0]?.count ?? 0;
  const summaryDoc = result.summary[0];
  const summary = summaryDoc
    ? {
        totalHands: summaryDoc.totalHands,
        netProfit: Math.round(summaryDoc.netProfit * 100) / 100,
        currency: summaryDoc.currencies.length === 1 ? summaryDoc.currencies[0] : null
      }
    : { totalHands: 0, netProfit: 0, currency: null };

  return { sessions: result.sessions, total, summary };
}

// Distinct stakes across every one of the user's sessions, for the History
// page's stakes filter dropdown - same derived-from-the-first-hand stakes
// concept listPaginated filters on above. Sorted by big-blind size
// (parseBigBlind, reused from bb-size scaling elsewhere) rather than
// alphabetically, or "$10/$20" would sort before "$2/$5".
export async function stakes(userId) {
  const result = await Session.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $addFields: { stakes: { $arrayElemAt: ['$hands.stakes', 0] } } },
    { $match: { stakes: { $ne: null } } },
    { $group: { _id: '$stakes' } },
  ]);
  return result
    .map(r => r._id)
    .sort((a, b) => (parseBigBlind(a, null) ?? 0) - (parseBigBlind(b, null) ?? 0));
}

// Hand detail for a single session, fetched on demand when a session row is
// expanded in the history view (or when it's opened for editing). Returns
// null if the session doesn't exist (or isn't this user's).
export async function sessionHands(userId, sessionId) {
  const session = await Session.findOne({ _id: sessionId, userId })
    .select('hands')
    .lean();
  if (!session) return null;
  return session.hands ?? [];
}

// Cross-session hand search backing the History page's search menu.
// Narrows candidates in Mongo first (userId, gameType, and - when hole
// cards were picked - a $elemMatch requiring the hero's holeCards be a
// superset of the selection), then finishes filtering in JS using the
// same predicates as the per-session filter bar. Card matching is plain
// containment ("hero held these cards"), which works unchanged for PLO's
// 4-card hands: an NLH hand simply can't match once more than 2 cards are
// selected, since its holeCards array only ever has 2 entries.
export async function searchHands(userId, { gameType, result, filter, position, holeCards, handClass, limit }) {
  const wantedClass = handClass ? String(handClass).trim() : null;
  const heroCards = (holeCards || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => c[0]?.toUpperCase() + c[1]?.toLowerCase());

  const cap = Math.min(Number(limit) || 100, 300);

  const matchStage = { userId: new mongoose.Types.ObjectId(userId) };
  if (gameType && gameType !== 'All') matchStage.gameType = gameType;

  const pipeline = [
    { $match: matchStage },
    { $project: { gameType: 1, currency: 1, date: 1, hands: 1 } },
    { $unwind: '$hands' },
  ];

  if (heroCards.length > 0) {
    pipeline.push({
      $match: {
        'hands.players': {
          $elemMatch: { isHero: true, holeCards: { $all: heroCards } },
        },
      },
    });
  }

  pipeline.push({ $sort: { 'hands.datePlayed': -1 } });
  // Safety ceiling on candidates pulled into Node before the JS-only
  // predicates (allIn/raise-count/position) below get applied.
  pipeline.push({ $limit: 1000 });

  const rows = await Session.aggregate(pipeline);

  const matched = [];
  for (const row of rows) {
    const hand = row.hands;
    const hero = hand.players?.find(p => p.isHero);
    if (!hero) continue;

    if (wantedClass) {
      const cls = classifyHoleCards(hero.holeCards);
      if (!cls || cls.token !== wantedClass) continue;
    }

    if (filter && !handMatchesFilter(hand, filter)) continue;

    const won = (hand.winners || []).includes(hero.name);
    if (result === 'won' && !won) continue;
    if (result === 'lost' && won) continue;

    if (position) {
      const posMap = getPositionMap(hand);
      if (posMap[hero.name] !== position) continue;
    }

    matched.push({
      hand,
      sessionId: row._id,
      sessionDate: row.date,
      sessionGameType: row.gameType,
      sessionCurrency: row.currency,
    });
    if (matched.length >= cap) break;
  }

  return { hands: matched, count: matched.length };
}

// Narrows `opponentLinks` ({ opponentName: personId | null }) to the entries
// safe to apply: a null (an explicit unlink) always survives, an id only if
// it's a valid ObjectId belonging to THIS user. Without the ownership check
// a client could point one of its seats at someone else's Person and have
// that person's stats recomputed over hands they never played.
//
// One query for the whole map, not one per entry - the modal can send a
// link for every opponent at the table at once.
async function sanitizeOpponentLinks(userId, opponentLinks) {
  const entries = Object.entries(opponentLinks || {});
  if (entries.length === 0) return {};

  const wanted = entries
    .filter(([, personId]) => personId != null)
    .map(([, personId]) => String(personId))
    .filter(id => mongoose.isValidObjectId(id));

  let owned = new Set();
  if (wanted.length > 0) {
    const found = await Person.find({ _id: { $in: wanted }, userId }).select('_id').lean();
    owned = new Set(found.map(p => String(p._id)));
  }

  const sanitized = {};
  for (const [name, personId] of entries) {
    if (personId == null) sanitized[name] = null;
    else if (owned.has(String(personId))) sanitized[name] = String(personId);
  }
  return sanitized;
}

// Returns null if the session doesn't exist (or isn't this user's).
//
// `opponentRenames` ({ oldName: newName }) and `opponentLinks`
// ({ name: personId | null }) are both keyed on the opponent name as the
// CLIENT saw it, so the loop below captures each seat's name before
// touching it and resolves both maps against that - applying the rename
// first would leave the link lookup searching for a name that no longer
// exists.
//
// Relinking a seat moves its hands from one Person to another, which
// invalidates the cached PlayerStats doc of both, so each affected person
// is recomputed after the save. Without this the linked player's profile
// page stays empty until something else (an import) happens to recompute it.
export async function updateSession(userId, sessionId, { date, gameType, opponentRenames, opponentLinks, totalProfit, starred }) {
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) return null;
  if (date) session.date = new Date(date);
  if (gameType) session.gameType = gameType;
  if (totalProfit !== undefined) session.totalProfit = Number(totalProfit);
  if (starred !== undefined) session.starred = Boolean(starred);

  const links = await sanitizeOpponentLinks(userId, opponentLinks);
  const hasLinks = Object.keys(links).length > 0;
  const hasRenames = opponentRenames && Object.keys(opponentRenames).length > 0;

  // Both the person losing the hands and the person gaining them need a
  // recompute, so previous ids are collected before they're overwritten.
  const affectedPersonIds = new Set();

  if ((hasLinks || hasRenames) && session.hands?.length > 0) {
    session.hands.forEach((hand) => {
      hand.players?.forEach((p) => {
        const original = p.name;
        // Hero is identified by isHero, never by a linked Person (see
        // PlayerStats.personId's comment), so hero seats are left alone
        // even if a name collision put one in the maps.
        if (!p.isHero && hasLinks && Object.prototype.hasOwnProperty.call(links, original)) {
          const nextId = links[original];
          if (p.personId) affectedPersonIds.add(String(p.personId));
          if (nextId) affectedPersonIds.add(String(nextId));
          p.personId = nextId ? new mongoose.Types.ObjectId(nextId) : null;
        }
        if (hasRenames && opponentRenames[original]) p.name = opponentRenames[original];
      });
      if (hasRenames) {
        hand.winners = hand.winners?.map(name => opponentRenames[name] || name);
        hand.actions?.forEach((a) => { if (a.player && opponentRenames[a.player]) a.player = opponentRenames[a.player]; });
      }
    });
    session.markModified('hands');
  }

  await session.save();

  // Sequential, and awaited rather than backgrounded: an edit touches one
  // or two people, and the caller closes a modal on the response - the
  // player's page has to be right by then.
  for (const personId of affectedPersonIds) {
    await recomputeStatsForPerson(userId, personId);
  }

  return session;
}

// Returns null if the session or hand doesn't exist (or isn't this user's).
export async function updateHandNotes(userId, sessionId, handId, notes) {
  const session = await Session.findOne({ _id: sessionId, userId });
  if (!session) return null;
  const hand = session.hands.id(handId);
  if (!hand) return null;
  hand.notes = notes || '';
  session.markModified('hands');
  await session.save();
  return hand;
}

// Returns null if the session doesn't exist (or isn't this user's).
//
// Deleting a session has to release its HandLedger rows too. Those rows
// are what make a hand count as "already imported", so leaving them behind
// would make every hand in a deleted session permanently un-importable -
// the user would delete a session, re-upload the same file, and be told
// every hand was a duplicate of something that no longer exists.
export async function deleteSession(userId, sessionId) {
  const session = await Session.findOneAndDelete({ _id: sessionId, userId });
  if (!session) return null;

  await HandLedger.deleteMany({ sessionId: session._id });

  // Keep the quota counters honest. $inc with negatives rather than a
  // recount, matching how the import path accrues them; $max clamps at
  // zero so a counter that has drifted can't go negative.
  const freed = BSON.calculateObjectSize(session.toObject());
  await UserModel.updateOne(
    { _id: userId },
    { $inc: { storageBytes: -freed, totalHands: -(session.totalHands || 0) } }
  );
  await UserModel.updateOne(
    { _id: userId, storageBytes: { $lt: 0 } },
    { $set: { storageBytes: 0 } }
  );
  await UserModel.updateOne(
    { _id: userId, totalHands: { $lt: 0 } },
    { $set: { totalHands: 0 } }
  );

  return session;
}

export async function deleteAllSessions(userId) {
  await Session.deleteMany({ userId });
  // Same reasoning as deleteSession: without this, a full reset would
  // leave the user unable to re-import anything they'd ever uploaded.
  await HandLedger.deleteMany({ userId });
  await UserModel.updateOne({ _id: userId }, { $set: { storageBytes: 0, totalHands: 0 } });
}
