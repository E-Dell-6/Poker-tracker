import * as sessionService from '../services/sessionService.js';
import { processUpload, createLegacySessionViaUploadPath } from '../services/sessionImportService.js';

// Backward compatible: several other callers (HomePage.jsx, Profile.jsx)
// fetch this route with no query params at all, expecting the plain array
// of every session they've always gotten - for their own full-history
// charts/summaries, not a list view. Only switch to the paginated envelope
// shape when a caller actually asks for pagination/filtering; everyone
// else keeps getting exactly what they got before this route changed.
export async function listSessions(req, res) {
  try {
    const userId = req.body.userId;
    const isPaginated = ['page', 'limit', 'gameType', 'starred', 'stakes'].some(k => req.query[k] !== undefined);
    if (!isPaginated) {
      const sessions = await sessionService.list(userId);
      return res.json(sessions);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const { sessions, total, summary } = await sessionService.listPaginated(userId, {
      page,
      limit,
      gameType: req.query.gameType,
      starred: req.query.starred,
      stakes: req.query.stakes,
    });

    res.json({ sessions, total, page, limit, summary });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

export async function listStakes(req, res) {
  try {
    const stakes = await sessionService.stakes(req.body.userId);
    res.json({ stakes });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stakes" });
  }
}

export async function getSessionHands(req, res) {
  try {
    const hands = await sessionService.sessionHands(req.body.userId, req.params.id);
    if (hands === null) return res.status(404).json({ error: "Session not found" });
    res.json({ hands });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hands", details: error.message });
  }
}

export async function searchHands(req, res) {
  try {
    const userId = req.body.userId;
    const { gameType, result, filter, position, holeCards, limit } = req.query;
    const matches = await sessionService.searchHands(userId, { gameType, result, filter, position, holeCards, limit });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: "Failed to search hands", details: error.message });
  }
}

// See sessionImportService.createLegacySessionViaUploadPath - appears to be
// unused/legacy code, relocated as-is.
export async function createLegacySession(req, res) {
  try {
    const { userId, ...fields } = req.body;
    const result = await createLegacySessionViaUploadPath(userId, fields);
    if (result.error === 'missing-fields') return res.status(400).json({ error: "Missing required session fields" });
    res.status(201).json({ message: "Session created successfully", sessionId: result.session._id, session: result.session.toObject() });
  } catch (error) {
    res.status(500).json({ error: "Failed to create session", details: error.message });
  }
}

// auth before multer now. NOTE: multer replaces req.body entirely once it
// parses the multipart form, so we can't rely on req.body.userId (set by
// userAuth) surviving past the upload.array() middleware. userAuth also
// stashes the id on req.userId, which multer never touches, so we read
// from there instead.
export async function uploadSessions(req, res) {
  try {
    const userId = req.userId;
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const results = await processUpload(userId, req.files);

    const successCount = results.filter(r => r.success).length;
    // 400 only if every single file failed; otherwise 200 with a per-file breakdown
    const status = successCount === 0 ? 400 : 200;
    res.status(status).json({
      message: successCount === req.files.length ? "Success" : "Some files could not be processed",
      results,
      successCount,
      totalCount: req.files.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process upload", details: error.message });
  }
}

export async function resetSessions(req, res) {
  try {
    await sessionService.deleteAllSessions(req.body.userId);
    res.status(200).json({ message: "Your sessions have been cleared." });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear database" });
  }
}

export async function updateSession(req, res) {
  try {
    const { userId, date, gameType, opponentRenames, totalProfit, starred } = req.body;
    const session = await sessionService.updateSession(userId, req.params.id, { date, gameType, opponentRenames, totalProfit, starred });
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: "Failed to update Session", details: error.message });
  }
}

export async function deleteSession(req, res) {
  try {
    const deleted = await sessionService.deleteSession(req.body.userId, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Session not found" });
    res.status(200).json({ message: "Session successfully deleted", sessionId: req.params.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete session", details: error.message });
  }
}
