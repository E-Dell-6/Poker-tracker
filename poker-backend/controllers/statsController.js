import PlayerStats from '../model/PlayerStats.js';
import { recomputeStatsForPerson, recomputeHeroStats } from '../services/statsService.js';

// GET /api/stats/me
export async function getHeroStats(req, res) {
  const stats = await PlayerStats.findOne({ userId: req.user.id, isHero: true }).lean();
  if (!stats) return res.status(404).json({ message: 'No hero stats computed yet' });
  res.json(stats);
}

// POST /api/stats/me/recompute
export async function refreshHeroStats(req, res) {
  const { sessionIds } = req.body; // optional: limit recompute to specific sessions
  const ids = sessionIds ?? (await getAllSessionIdsForUser(req.user.id));
  const stats = await recomputeHeroStats(req.user.id, ids);
  res.json(stats);
}

// GET /api/stats/person/:personId
export async function getPersonStats(req, res) {
  const stats = await PlayerStats.findOne({
    userId: req.user.id,
    personId: req.params.personId
  }).lean();
  if (!stats) return res.status(404).json({ message: 'No stats computed yet for this player' });
  res.json(stats);
}

// POST /api/stats/person/:personId/recompute
export async function refreshPersonStats(req, res) {
  const stats = await recomputeStatsForPerson(req.user.id, req.params.personId);
  res.json(stats);
}

// GET /api/stats/players — table view of every tracked opponent
export async function listPlayerStats(req, res) {
  const stats = await PlayerStats.find({ userId: req.user.id, isHero: false }).lean();
  res.json(stats);
}

// Placeholder — wire this up to however sessions are actually stored
// (likely a query against your Session model filtered by userId).
async function getAllSessionIdsForUser(userId) {
  const Session = (await import('../model/Session.js')).default;
  const sessions = await Session.find({ userId }).select('_id').lean();
  return sessions.map(s => String(s._id));
}