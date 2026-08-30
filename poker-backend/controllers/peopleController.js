import mongoose from 'mongoose';
import Person from '../model/People.js';
import { getStarredItemsForPerson } from '../services/favouritesService.js';
import { escapeRegex } from '../utils/regex.js';

// whitelist: blocks operator keys (e.g. $unset) from reaching Mongo
const EDITABLE_FIELDS = ['name', 'image', 'starred'];

function pickEditableFields(body) {
  const updates = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  return updates;
}

// Paginated (page/limit query params, default 50, capped at 100), with
// optional name search and starred-only filtering pushed into the same
// query as the pagination - both have to happen server-side together (not
// layered on top of a paginated fetch client-side), or a search would only
// ever match whichever page happened to already be loaded. No existing
// sort order to preserve (the old unpaginated version had none) -
// alphabetical by name is the natural default for a roster.
//
// Backward compatible: several other callers (EditSessionLog.jsx,
// PlayerSeat.jsx, HandCreator.jsx, PlayerProfile.jsx) fetch this route with
// no query params, expecting the plain array of every tracked person they've
// always gotten - for small person-picker dropdowns, not a paginated list
// view. Only switch to the paginated envelope shape when a caller actually
// asks for pagination/filtering.
export async function listPeople(req, res) {
  try {
    const userId = req.body.userId; // query param dropped: was an IDOR
    const isPaginated = ['page', 'limit', 'search', 'starred'].some(k => req.query[k] !== undefined);
    if (!isPaginated) {
      const people = await Person.find({ userId });
      return res.json(people);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = { userId };
    if (req.query.search) {
      query.name = { $regex: escapeRegex(req.query.search), $options: 'i' };
    }
    if (req.query.starred === 'true') {
      query.starred = true;
    }

    const [players, total] = await Promise.all([
      Person.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      Person.countDocuments(query),
    ]);
    res.json({ players, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch people" });
  }
}

export async function createPerson(req, res) {
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
}

export async function addTag(req, res) {
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
}

export async function updateNotes(req, res) {
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
}

// Returns hands and sessions this player is part of that the user has
// starred - see favouritesService.getStarredItemsForPerson for the
// Favorite/Session join itself.
export async function getStarred(req, res) {
  try {
    const { userId } = req.body;
    const { personId } = req.params;
    if (!mongoose.isValidObjectId(personId)) {
      return res.status(400).json({ error: "Invalid person id" });
    }

    const result = await getStarredItemsForPerson(userId, personId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch starred items", details: err.message });
  }
}

export async function deleteTag(req, res) {
  try {
    const person = await Person.findOne({ _id: req.params.personId, userId: req.body.userId });
    if (!person) return res.status(404).json({ error: "Person not found" });
    person.tags = person.tags.filter(tag => tag.label !== req.params.tagLabel);
    await person.save();
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: "Failed to delete tag" });
  }
}

export async function replacePerson(req, res) {
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
}

export async function updatePerson(req, res) {
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
}
