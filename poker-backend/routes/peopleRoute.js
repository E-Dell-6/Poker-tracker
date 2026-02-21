import express from 'express';
import Person from '../model/People.js';
import userAuth from '../middleware/userAuth.js';

const router = express.Router();

router.use(userAuth);

router.get('/', async (req, res) => {
    try {
        const people = await Person.find({ userId: req.body.userId });
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
        const { userId, ...updates } = req.body;
        const person = await Person.findOneAndUpdate(
            { _id: req.params.personId, userId },
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
        const { userId, ...updates } = req.body;
        const person = await Person.findOneAndUpdate(
            { _id: req.params.personId, userId },
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