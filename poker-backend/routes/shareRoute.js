
import express from 'express';
import crypto from 'crypto';
import SharedHand from '../model/sharedHand.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

const generateShareId = () => crypto.randomBytes(9).toString('base64url').slice(0, 12);

router.get('/:shareId', async (req, res) => {
    try {
        const doc = await SharedHand.findOne({ shareId: req.params.shareId });
        if (!doc) return res.status(404).json({ error: 'Hand not found or link has expired.' });
        res.json({ hand: doc.hand });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch shared hand.', details: err.message });
    }
});


router.post('/', userAuth, async (req, res) => {
    try {
        const { userId, hand } = req.body;
        if (!hand?._id) return res.status(400).json({ error: 'hand._id is required.' });

        
        const existing = await SharedHand.findOne({ userId, handId: hand._id.toString() });
        if (existing) return res.json({ shareId: existing.shareId });

        const shareId = generateShareId();
        await SharedHand.create({ shareId, userId, handId: hand._id.toString(), hand });
        res.status(201).json({ shareId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create share link.', details: err.message });
    }
});


router.delete('/:shareId', userAuth, async (req, res) => {
    try {
        const { userId } = req.body;
        const doc = await SharedHand.findOneAndDelete({ shareId: req.params.shareId, userId });
        if (!doc) return res.status(404).json({ error: 'Share link not found or you do not own it.' });
        res.json({ message: 'Share link revoked.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to revoke share link.', details: err.message });
    }
});

export default router;