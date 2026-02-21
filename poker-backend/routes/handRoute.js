import express from 'express';
import Favorite from '../model/favourites.js';
import Session from '../model/Session.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.use(userAuth);

// Helper: get or create the user's favorites doc
const getUserFaves = async (userId) => {
    let faves = await Favorite.findOne({ userId });
    if (!faves) faves = await Favorite.create({ userId, hands: [] });
    return faves;
};

// GET all favourites
router.get('/', async (req, res) => {
    try {
        const faves = await Favorite.findOne({ userId: req.body.userId });
        res.json(faves ? faves.hands : []);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch favourites", details: error.message });
    }
});

// POST toggle favourite
router.post('/:id', async (req, res) => {
    try {
        const { userId } = req.body;
        const handId = req.params.id;
        const faves = await getUserFaves(userId);

        const existingIndex = faves.hands.findIndex(h => h._id && h._id.toString() === handId);

        if (existingIndex !== -1) {
            faves.hands.splice(existingIndex, 1);
            await faves.save();
            return res.json({ hands: faves.hands, isFavorited: false });
        }

        if (req.body && Object.keys(req.body).filter(k => k !== 'userId').length > 0) {
            const { userId: _uid, ...handData } = req.body;
            faves.hands.push(handData);
            await faves.save();
            return res.json({ hands: faves.hands, isFavorited: true });
        }

        const sessions = await Session.find({ userId }).lean();
        let foundHand = null, foundSession = null;
        for (const session of sessions) {
            const hand = session.hands?.find(h => h._id && h._id.toString() === handId);
            if (hand) { foundHand = hand; foundSession = session; break; }
        }
        if (!foundHand) return res.status(404).json({ error: "Hand not found" });

        faves.hands.push({ ...foundHand, sessionDate: foundSession.date, sessionGameType: foundSession.gameType, sessionId: foundSession._id });
        await faves.save();
        return res.json({ hands: faves.hands, isFavorited: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to toggle favourite", details: error.message });
    }
});

router.patch('/:id/holeCards', async (req, res) => {
    try {
        const { userId, holeCards, playerSeatNumber } = req.body;
        const faves = await Favorite.findOne({ userId });
        const hand = faves.hands.find(h => h._id && h._id.toString() === req.params.id);
        if (!hand) return res.status(400).json({ error: "hand not found" });
        const player = hand.players.find(p => p.seat === playerSeatNumber);
        if (holeCards) player.holeCards = holeCards;
        await faves.save();
        res.json({ hand, message: "Hand updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update favourites", details: error.message });
    }
});

router.patch('/:id/action', async (req, res) => {
    try {
        const { userId, actionType, amount = 0, street, playerSeatNumber } = req.body;
        const faves = await Favorite.findOne({ userId });
        if (!faves) return res.status(404).json({ error: "Favorites not found" });
        const hand = faves.hands.find(h => h._id && h._id.toString() === req.params.id);
        if (!hand) return res.status(404).json({ error: "Hand not found" });
        const player = hand.players.find(p => p.seat === playerSeatNumber);
        if (!player) return res.status(404).json({ error: `Player not found at seat ${playerSeatNumber}` });
        const lastPotSize = hand.actions.length > 0 ? hand.actions[hand.actions.length - 1].potSizeAfter : 0;
        const newAction = { street, actionType, amount, player: player.name, potSizeAfter: lastPotSize + amount };
        hand.actions.push(newAction);
        faves.markModified('hands');
        await faves.save();
        res.status(200).json({ message: "Action added successfully", action: newAction, actions: hand.actions, potSize: newAction.potSizeAfter });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
});

router.patch('/:id/name', async (req, res) => {
    try {
        const { userId, newName, playerSeatNumber } = req.body;
        const faves = await Favorite.findOne({ userId });
        if (!faves) return res.status(404).json({ error: "Favorites not found" });
        const hand = faves.hands.find(h => h._id && h._id.toString() === req.params.id);
        if (!hand) return res.status(404).json({ error: "Hand not found" });
        const player = hand.players.find(p => p.seat === playerSeatNumber);
        if (!player) return res.status(404).json({ error: "Player not found" });
        player.name = newName;
        faves.markModified('hands');
        await faves.save();
        res.json({ hand, message: "Player name updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update player name", details: error.message });
    }
});

router.patch('/:id/blinds', async (req, res) => {
    try {
        const { userId, dealerSeat } = req.body;
        const faves = await Favorite.findOne({ userId });
        if (!faves) return res.status(404).json({ error: "Favorites not found" });
        const hand = faves.hands.find(h => h._id && h._id.toString() === req.params.id);
        if (!hand) return res.status(404).json({ error: "Hand not found" });
        const totalPlayers = hand.players.length;
        const sbSeat = (dealerSeat + 1) % totalPlayers;
        const bbSeat = (dealerSeat + 2) % totalPlayers;
        const sbPlayer = hand.players.find(p => p.seat === sbSeat);
        const bbPlayer = hand.players.find(p => p.seat === bbSeat);
        if (!sbPlayer || !bbPlayer) return res.status(400).json({ error: "Could not find players for blind positions" });
        hand.players.forEach(p => p.isDealer = false);
        const dealerPlayer = hand.players.find(p => p.seat === dealerSeat);
        if (dealerPlayer) dealerPlayer.isDealer = true;
        if (!hand.actions) hand.actions = [];
        hand.actions.push({ player: sbPlayer.name, street: "PREFLOP", actionType: "POST_SB", amount: 0.5 });
        hand.actions.push({ player: bbPlayer.name, street: "PREFLOP", actionType: "POST_BB", amount: 1 });
        faves.markModified('hands');
        await faves.save();
        res.json({ success: true, dealerSeat, sbSeat, bbSeat, actions: hand.actions });
    } catch (err) {
        res.status(500).json({ error: "Failed to update dealer and blinds", details: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const faves = await Favorite.findOne({ userId: req.body.userId });
        if (!faves) return res.status(404).json({ error: "Favorites document not found" });
        const handIndex = faves.hands.findIndex(h => h._id && h._id.toString() === req.params.id);
        if (handIndex === -1) return res.status(404).json({ error: "Hand not found in favourites" });
        faves.hands.splice(handIndex, 1);
        faves.markModified('hands');
        await faves.save();
        res.json({ message: "Deleted favourite hand" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.delete('/', async (req, res) => {
    try {
        await Favorite.deleteMany({ userId: req.body.userId });
        res.json({ message: "All favourites cleared successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to clear favourites", details: error.message });
    }
});

export default router;