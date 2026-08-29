import express from 'express';
import mongoose from 'mongoose';
import Person from '../model/People.js';
import Session from '../model/Session.js';
import Favorite from '../model/favourites.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.use(userAuth);

// whitelist: blocks operator keys (e.g. $unset) from reaching Mongo
const EDITABLE_FIELDS = ['name', 'image', 'starred'];

function pickEditableFields(body) {
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) updates[field] = body[field];
    }
    return updates;
}

router.get('/', async (req, res) => {
    try {
        const userId = req.body.userId; // query param dropped: was an IDOR
        const people = await Person.find({ userId });
        res.json(people);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch people" });
    }
});

router.post('/', async (req, res) => {
    try {
        const newPerson = new Person({
            userId: req.body.userId,
            name: req.body.name,
            image: req.body.image || "",
            tags: []
        });
        const saved = await newPerson.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: "Could not create player. Name might already exist." });
    }
});

router.post('/:personId/tags', async (req, res) => {
    try {
        const { userId, label, color } = req.body;
        if (!label || !color) return res.status(400).json({ error: "Label and color are required" });
        const person = await Person.findOne({ _id: req.params.personId, userId });
        if (!person) return res.status(404).json({ error: "Person not found" });
        if (person.tags.some(tag => tag.label === label)) return res.status(400).json({ error: "Tag with this label already exists" });
        person.tags.push({ label, color });
        await person.save();
        res.status(201).json(person);
    } catch (err) {
        res.status(500).json({ error: "Failed to add tag" });
    }
});

router.post('/:personId/notes', async (req, res) => {
    try {
        const { userId, notes } = req.body;
        const person = await Person.findOne({ _id: req.params.personId, userId });
        if (!person) return res.status(404).json({ error: "Person not found" });
        person.notes = notes || "";
        await person.save();
        res.status(200).json(person);
    } catch (err) {
        res.status(500).json({ error: "Failed to update notes" });
    }
});

// Returns hands and sessions this player is part of that the user has
// starred - hands via the Favorite doc (players[].personId), sessions via
// Session.starred plus a hands.players.personId match. Sessions are
// projected without `hands` (same as GET /sessions) since only the
// summary fields are needed here; the match against hands.players is
// still possible pre-projection because Mongo evaluates $match first.
router.get('/:personId/starred', async (req, res) => {
    try {
        const { userId } = req.body;
        const { personId } = req.params;
        if (!mongoose.isValidObjectId(personId)) {
            return res.status(400).json({ error: "Invalid person id" });
        }

        const faves = await Favorite.findOne({ userId });
        const starredHands = (faves?.hands || []).filter(hand =>
            hand.players?.some(p => p.personId && p.personId.toString() === personId)
        );

        const starredSessions = await Session.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    starred: true,
                    'hands.players.personId': new mongoose.Types.ObjectId(personId),
                },
            },
            { $project: { hands: 0 } },
            { $sort: { uploadDate: -1 } },
        ]);

        res.json({ starredHands, starredSessions });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch starred items", details: err.message });
    }
});

router.delete('/:personId/tags/:tagLabel', async (req, res) => {
    try {
        const person = await Person.findOne({ _id: req.params.personId, userId: req.body.userId });
        if (!person) return res.status(404).json({ error: "Person not found" });
        person.tags = person.tags.filter(tag => tag.label !== req.params.tagLabel);
        await person.save();
        res.json(person);
    } catch (err) {
        res.status(500).json({ error: "Failed to delete tag" });
    }
});

router.put('/:personId', async (req, res) => {
    try {
        const updates = pickEditableFields(req.body);
        const person = await Person.findOneAndUpdate(
            { _id: req.params.personId, userId: req.body.userId },
            updates,
            { new: true, runValidators: true }
        );
        if (!person) return res.status(404).json({ error: "Person not found" });
        res.json(person);
    } catch (err) {
        res.status(500).json({ error: "Failed to update person" });
    }
});

router.patch('/:personId', async (req, res) => {
    try {
        const updates = pickEditableFields(req.body);
        const person = await Person.findOneAndUpdate(
            { _id: req.params.personId, userId: req.body.userId },
            { $set: updates },
            { new: true, runValidators: true }
        );
        if (!person) return res.status(404).json({ error: "Person not found" });
        res.json(person);
    } catch (err) {
        res.status(500).json({ error: "Failed to update person" });
    }
});

export default router;