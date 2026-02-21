import express from 'express';
import LiveSession from '../model/LiveSession.js';

const router = express.Router();

// GET /api/live-sessions
router.get('/', async (req, res) => {
    try {
        const userId = req.user?._id ?? req.userId;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const sessions = await LiveSession.find({ userId }).sort({ date: -1 }).lean();
        res.json(sessions);
    } catch (err) {
        console.error('GET /api/live-sessions:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/live-sessions  — called by Clock.jsx on clock-out
router.post('/', async (req, res) => {
    try {
        const userId = req.user?._id ?? req.userId;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const {
            clockInTime, clockOutTime,
            smallBlind, bigBlind,
            buyIns, totalBuyIn,
            cashOut, totalProfit,
            gameType,
        } = req.body;

        const session = await LiveSession.create({
            userId,
            clockInTime:  new Date(clockInTime),
            clockOutTime: new Date(clockOutTime),
            smallBlind:   Number(smallBlind),
            bigBlind:     Number(bigBlind),
            buyIns:       Array.isArray(buyIns) ? buyIns.map(Number) : [],
            totalBuyIn:   Number(totalBuyIn),
            cashOut:      Number(cashOut),
            totalProfit:  Number(totalProfit),
            gameType:     gameType ?? 'Cash Game',
        });

        res.status(201).json(session);
    } catch (err) {
        console.error('POST /api/live-sessions:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/live-sessions/:id
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user?._id ?? req.userId;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const session = await LiveSession.findOneAndDelete({ _id: req.params.id, userId });
        if (!session) return res.status(404).json({ message: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/live-sessions:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;