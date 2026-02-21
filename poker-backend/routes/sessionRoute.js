import express from 'express';
import multer from 'multer';
import { parsePokerNowLog } from '../utils/pokerNowParser.js';
import Session from '../model/Session.js';
import LiveSession from '../model/LiveSession.js';
import mongoose from 'mongoose';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

// multer runs first so req.body is populated before userAuth reads userId
router.post('/upload', upload.single('csvFile'), userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const csvContent = req.file.buffer.toString('utf8');
        const parsedHands = parsePokerNowLog(csvContent);
        if (parsedHands.length === 0) return res.status(400).json({ error: "No hands found in the uploaded file" });
        parsedHands.forEach(hand => { if (!hand._id) hand._id = new mongoose.Types.ObjectId(); });
        const session = new Session({
            userId,
            sessionType: 'upload',
            date: parsedHands[0].datePlayed,
            gameType: parsedHands[0].gameType,
            totalHands: parsedHands.length,
            totalProfit: parsedHands.reduce((sum, h) => sum + (h.finalPotSize || 0), 0),
            hands: parsedHands
        });
        await session.save();
        res.status(200).json({ message: "Success", sessionId: session._id, totalHands: parsedHands.length });
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
