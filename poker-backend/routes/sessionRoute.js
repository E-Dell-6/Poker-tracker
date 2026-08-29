import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { parsePokerLog } from '../utils/parsePokerLog.js';
import Session from '../model/Session.js';
import LiveSession from '../model/LiveSession.js';
import mongoose from 'mongoose';
import userAuth from '../middleware/userAuth.js';
import { attachPersonIdsToHands } from '../services/personService.js';
import { recomputeStatsForNewHands } from '../services/statsService.js';
import { handMatchesFilter } from '../utils/handFilters.js';
import { getPositionMap } from '../utils/statsEngine.js';
import { computeEffectiveStacks } from '../utils/effectiveStackCalculator.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, adjust as needed
});

// currency per parser format; add new sites here + Session schema enum
const FORMAT_CURRENCY = {
    ACR: 'USD',
    GGPOKER: 'CAD',
    POKERNOW: 'CHIPS',
};

// List view: deliberately excludes `hands` (each session can carry hundreds
// of nested hand documents - players/actions/board/etc). The history page
// only needs per-hand detail for whichever single session the user expands,
// so that's fetched separately via GET /sessions/:id/hands. This keeps the
// list fast regardless of how much hand history a user has accumulated.
// gameType (including the 'Heads-Up' override) is now decided once at
// upload time (see POST /upload below) instead of being recomputed from
// `hands` on every read.
router.get('/sessions', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        // totalHands is only stamped onto sessions created via POST /upload
        // after this field was introduced - older sessions in the DB never
        // got it set. Rather than requiring a one-off backfill migration,
        // fall back to computing it from hands.length server-side ($size),
        // so it self-heals for any session regardless of when it was
        // created. hands itself is still dropped before the doc leaves
        // Mongo, so the payload to the client stays small either way.
        const sessions = await Session.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $addFields: {
                totalHands: {
                    $ifNull: ["$totalHands", { $size: { $ifNull: ["$hands", []] } }]
                }
            }},
            { $project: { hands: 0 } },
            { $sort: { uploadDate: -1 } },
        ]);
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

// Hand detail for a single session, fetched on demand when a session row is
// expanded in the history view (or when it's opened for editing).
router.get('/sessions/:id/hands', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        const session = await Session.findOne({ _id: req.params.id, userId })
            .select('hands')
            .lean();
        if (!session) return res.status(404).json({ error: "Session not found" });
        res.json({ hands: session.hands ?? [] });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch hands", details: error.message });
    }
});

// Cross-session hand search backing the History page's search menu.
// Narrows candidates in Mongo first (userId, gameType, and - when hole
// cards were picked - a $elemMatch requiring the hero's holeCards be a
// superset of the selection), then finishes filtering in JS using the
// same predicates as the per-session filter bar. Card matching is plain
// containment ("hero held these cards"), which works unchanged for PLO's
// 4-card hands: an NLH hand simply can't match once more than 2 cards are
// selected, since its holeCards array only ever has 2 entries.
router.get('/hands/search', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        const { gameType, result, filter, position, holeCards, limit } = req.query;

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

        res.json({ hands: matched, count: matched.length });
    } catch (error) {
        res.status(500).json({ error: "Failed to search hands", details: error.message });
    }
});

router.post('/sessions', userAuth, async (req, res) => {
    try {
        const { userId, clockInTime, clockOutTime, smallBlind, bigBlind, buyIns, totalBuyIn, cashOut, profit, gameType } = req.body;
        if (!clockInTime || !clockOutTime || cashOut === undefined || !buyIns?.length)
            return res.status(400).json({ error: "Missing required session fields" });
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
        res.status(201).json({ message: "Session created successfully", sessionId: session._id, session: session.toObject() });
    } catch (error) {
        res.status(500).json({ error: "Failed to create session", details: error.message });
    }
});

// auth before multer now. NOTE: multer replaces req.body entirely once it parses
// the multipart form, so we can't rely on req.body.userId (set by userAuth) surviving
// past the upload.single() middleware. userAuth also stashes the id on req.userId,
// which multer never touches, so we read from there instead.
// upload.array lets the client send several files under the same 'csvFile'
// field name in one request. Each file is processed independently so one
// duplicate/bad file in the batch doesn't block the rest.
router.post('/upload', userAuth, upload.array('csvFile', 20), async (req, res) => {
    try {
        const userId = req.userId;
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });

        const results = [];

        for (const file of req.files) {
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

                // Currency isn't known to the parser itself (ACR/GGPoker log
                // dollar amounts in cents, PokerNow in play chips - see
                // FORMAT_CURRENCY above) - it's only resolved here, from the
                // upload format. computeEffectiveStacks needs it to convert
                // stack sizes into bb units correctly, so it has to run here
                // rather than inside the parser, using a shallow copy that
                // carries `currency` without persisting it on the hand doc
                // itself (HandSchema has no `currency` field - see
                // statsService.js's extractHands for why that's per-Session).
                const currency = FORMAT_CURRENCY[format] ?? 'CHIPS';
                parsedHands.forEach(hand => computeEffectiveStacks({ ...hand, currency }));

                // Every named player gets a Person record (auto-created on first
                // sight, reused after) so stats can be tracked without requiring
                // a manual "map this player" step first.
                await attachPersonIdsToHands(userId, parsedHands);

                const session = new Session({
                    userId,
                    fileHash,
                    sessionType: 'upload',
                    source: format,
                    currency,
                    date: parsedHands[0].datePlayed,
                    // Same "2 players seated = Heads-Up" override the old list
                    // route used to compute on every read; decided once here
                    // instead so GET /sessions doesn't need `hands` at all.
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
                recomputeStatsForNewHands(userId, parsedHands).catch(err => {
                    console.error(`Stats recompute failed for session ${session._id}:`, err);
                });

                results.push({ filename, success: true, sessionId: session._id, totalHands: parsedHands.length, source: format });
            } catch (fileError) {
                results.push({ filename, success: false, error: fileError.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        // 400 only if every single file failed; otherwise 200 with a per-file breakdown
        const status = successCount === 0 ? 400 : 200;
        res.status(status).json({
            message: successCount === req.files.length ? "Success" : "Some files could not be processed",
            results,
            successCount,
            totalCount: req.files.length,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to process upload", details: error.message });
    }
});

router.delete('/reset', userAuth, async (req, res) => {
    try {
        await Session.deleteMany({ userId: req.body.userId });
        res.status(200).json({ message: "Your sessions have been cleared." });
    } catch (error) {
        res.status(500).json({ error: "Failed to clear database" });
    }
});

router.put('/sessions/:id', userAuth, async (req, res) => {
    try {
        const { userId, date, gameType, opponentRenames, totalProfit, starred } = req.body;
        const session = await Session.findOne({ _id: req.params.id, userId });
        if (!session) return res.status(404).json({ error: "Session not found" });
        if (date) session.date = new Date(date);
        if (gameType) session.gameType = gameType;
        if (totalProfit !== undefined) session.totalProfit = Number(totalProfit);
        if (starred !== undefined) session.starred = Boolean(starred);
        if (opponentRenames && Object.keys(opponentRenames).length > 0 && session.hands?.length > 0) {
            session.hands.forEach((hand) => {
                hand.players?.forEach((p) => { if (opponentRenames[p.name]) p.name = opponentRenames[p.name]; });
                hand.winners = hand.winners?.map(name => opponentRenames[name] || name);
                hand.actions?.forEach((a) => { if (a.player && opponentRenames[a.player]) a.player = opponentRenames[a.player]; });
            });
            session.markModified('hands');
        }
        res.json(await session.save());
    } catch (error) {
        res.status(500).json({ error: "Failed to update Session", details: error.message });
    }
});

router.delete('/sessions/:id', userAuth, async (req, res) => {
    try {
        const deleted = await Session.findOneAndDelete({ _id: req.params.id, userId: req.body.userId });
        if (!deleted) return res.status(404).json({ error: "Session not found" });
        res.status(200).json({ message: "Session successfully deleted", sessionId: req.params.id });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete session", details: error.message });
    }
});

export default router;