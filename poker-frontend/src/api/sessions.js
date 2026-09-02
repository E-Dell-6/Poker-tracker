import { apiFetch, requestJson } from "./http";

export async function getSessionHands(sessionId) {
  const data = await requestJson(`/api/sessions/${sessionId}/hands`, {}, "Failed to load hands");
  return Array.isArray(data.hands) ? data.hands : [];
}

export async function deleteSession(id) {
  return requestJson(`/api/sessions/${id}`, { method: "DELETE" }, "Failed to delete session");
}

export async function updateSession(id, patch) {
  return requestJson(`/api/sessions/${id}`, { method: "PUT", body: patch }, "Failed to update session");
}

export async function updateHandNotes(sessionId, handId, notes) {
  return requestJson(
    `/api/sessions/${sessionId}/hands/${handId}/notes`,
    { method: "PATCH", body: { notes } },
    "Failed to update hand notes"
  );
}

export async function mapSessionPlayer(sessionId, { pokerNowName, personId }) {
  return requestJson(
    `/api/sessions/${sessionId}/map-player`,
    { method: "POST", body: { pokerNowName, personId } },
    "Mapping failed"
  );
}

// No ok-check, matching the original call sites exactly - callers already
// handle a malformed/empty body via their own Array.isArray()/?? guards.
export async function getSessions({ page, limit, gameType, stakes, starred }) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (gameType && gameType !== "All") params.set("gameType", gameType);
  if (stakes && stakes !== "All") params.set("stakes", stakes);
  if (starred) params.set("starred", "true");
  const res = await apiFetch(`/api/sessions?${params.toString()}`);
  return res.json();
}

export async function getSessionStakes() {
  const res = await apiFetch("/api/sessions/stakes");
  return res.json();
}

export async function getAllSessions() {
  return requestJson("/api/sessions");
}
