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

router.get('/sessions', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        const sessions = await Session.find({ userId }).sort({ uploadDate: -1 });
        const processedSessions = sessions.map(session => {
            const sessionObj = session.toObject();
            if (sessionObj.hands?.length > 0) {
                if (sessionObj.hands[0].players?.length === 2) sessionObj.gameType = 'Heads-Up';
                sessionObj.hands = sessionObj.hands.map(hand => ({ ...hand, _id: hand._id }));
            }
            return sessionObj;
        });
        res.json(processedSessions);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch sessions" });
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

                // Every named player gets a Person record (auto-created on first
                // sight, reused after) so stats can be tracked without requiring
                // a manual "map this player" step first.
                await attachPersonIdsToHands(userId, parsedHands);

                const session = new Session({
                    userId,
                    fileHash,
                    sessionType: 'upload',
                    source: format,
                    currency: FORMAT_CURRENCY[format] ?? 'CHIPS',
                    date: parsedHands[0].datePlayed,
                    gameType: parsedHands[0].gameType,
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
        const { userId, date, gameType, opponentRenames, totalProfit } = req.body;
        const session = await Session.findOne({ _id: req.params.id, userId });
        if (!session) return res.status(404).json({ error: "Session not found" });
        if (date) session.date = new Date(date);
        if (gameType) session.gameType = gameType;
        if (totalProfit !== undefined) session.totalProfit = Number(totalProfit);
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