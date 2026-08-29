import PlayerStats from '../model/PlayerStats.js';
import { recomputeStatsForPerson, recomputeHeroStats, getHeroEvGraph } from '../services/statsService.js';

// GET /api/stats/me
export async function getHeroStats(req, res) {
  const stats = await PlayerStats.findOne({ userId: req.userId, isHero: true }).lean();
  if (!stats) return res.status(404).json({ message: 'No hero stats computed yet' });
  res.json(stats);
}

// POST /api/stats/me/recompute
export async function refreshHeroStats(req, res) {
  const stats = await recomputeHeroStats(req.userId);
  res.json(stats);
}

// GET /api/stats/person/:personId
export async function getPersonStats(req, res) {
  const stats = await PlayerStats.findOne({
    userId: req.userId,
    personId: req.params.personId
  }).lean();
  if (!stats) return res.status(404).json({ message: 'No stats computed yet for this player' });
  res.json(stats);
}

// POST /api/stats/person/:personId/recompute
export async function refreshPersonStats(req, res) {
  const stats = await recomputeStatsForPerson(req.userId, req.params.personId);
  res.json(stats);
}

// GET /api/stats/players - table view of every tracked opponent
export async function listPlayerStats(req, res) {
  const stats = await PlayerStats.find({ userId: req.userId, isHero: false }).lean();
  res.json(stats);
}

// GET /api/stats/me/ev-graph
export async function getHeroEvGraphRoute(req, res) {
  const rows = await getHeroEvGraph(req.userId);
  res.json(rows);
}