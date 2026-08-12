import express from 'express';
import LiveSession from '../model/LiveSession.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.get('/active', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        const session = await LiveSession.findOne({ userId, status: 'active' }).lean();
        res.json(session); // null if nothing is active
    } catch (err) {
        console.error('GET /api/live-sessions/active:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;

        const sessions = await LiveSession.find({ userId, status: 'completed' }).sort({ date: -1 }).lean();
        res.json(sessions);
    } catch (err) {
        console.error('GET /api/live-sessions:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/clock-in', userAuth, async (req, res) => {
    try {
        const { userId, clockInTime, smallBlind, bigBlind, buyIns, totalBuyIn } = req.body;

        const existing = await LiveSession.findOne({ userId, status: 'active' }).lean();
        if (existing) {
            return res.status(409).json({ message: 'A session is already active', session: existing });
        }

        const session = await LiveSession.create({
            userId,
            clockInTime: new Date(clockInTime),
            smallBlind: Number(smallBlind),
            bigBlind: Number(bigBlind),
            buyIns: Array.isArray(buyIns) ? buyIns.map(Number) : [],
            totalBuyIn: Number(totalBuyIn),
            status: 'active',
        });

        res.status(201).json(session);
    } catch (err) {
        console.error('POST /api/live-sessions/clock-in:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/buy-in', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        const amount = Number(req.body.amount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Invalid buy-in amount' });
        }

        const session = await LiveSession.findOne({ _id: req.params.id, userId, status: 'active' });
        if (!session) return res.status(404).json({ message: 'Active session not found' });

        session.buyIns.push(amount);
        session.totalBuyIn += amount;
        await session.save();

        res.json(session);
    } catch (err) {
        console.error('POST /api/live-sessions/:id/buy-in:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/clock-out', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;
        const cashOut = Number(req.body.cashOut);
        if (isNaN(cashOut)) return res.status(400).json({ message: 'Invalid cash out amount' });

        const session = await LiveSession.findOne({ _id: req.params.id, userId, status: 'active' });
        if (!session) return res.status(404).json({ message: 'Active session not found' });

        session.clockOutTime = new Date();
        session.cashOut = cashOut;
        session.totalProfit = cashOut - session.totalBuyIn;
        session.date = session.clockInTime;
        session.status = 'completed';
        await session.save();

        res.json(session);
    } catch (err) {
        console.error('POST /api/live-sessions/:id/clock-out:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/:id', userAuth, async (req, res) => {
    try {
        const userId = req.body.userId;

        // Only completed sessions can be deleted this way; an active session
        // should be ended (clock-out) rather than removed outright.
        const session = await LiveSession.findOneAndDelete({ _id: req.params.id, userId, status: 'completed' });
        if (!session) return res.status(404).json({ message: 'Session not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/live-sessions:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;