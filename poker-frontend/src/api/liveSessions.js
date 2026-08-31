import { requestJson } from "./http";

// The userAuth middleware doesn't reject an unauthenticated request with a
// real HTTP error - it responds 200 with { success: false, message: ... }
// (see poker-backend/middleware/userAuth.js). A genuine live-sessions
// response never has a `success` field (it's the raw array/document/null),
// so this is a safe, unambiguous way to tell "not signed in" apart from
// real data rather than passing that sentinel object through as if it
// were a session.
function isAuthFailure(data) {
  return !!data && data.success === false;
}

export async function getLiveSessions() {
  const data = await requestJson("/api/live-sessions", {}, "Failed to load sessions");
  return isAuthFailure(data) ? [] : data;
}

export async function getActiveLiveSession() {
  const data = await requestJson("/api/live-sessions/active", {}, "Failed to check active session");
  return isAuthFailure(data) ? null : data;
}

export async function clockIn({ clockInTime, bigBlind, smallBlind, buyIns, totalBuyIn }) {
  return requestJson(
    "/api/live-sessions/clock-in",
    { method: "POST", body: { clockInTime, bigBlind, smallBlind, buyIns, totalBuyIn } },
    "Failed to start session"
  );
}

export async function clockOut(sessionId, cashOut) {
  return requestJson(
    `/api/live-sessions/${sessionId}/clock-out`,
    { method: "POST", body: { cashOut } },
    "Failed to save session"
  );
}

export async function addBuyIn(sessionId, amount) {
  return requestJson(
    `/api/live-sessions/${sessionId}/buy-in`,
    { method: "POST", body: { amount } },
    "Failed to add buy-in"
  );
}

export async function deleteLiveSession(id) {
  return requestJson(`/api/live-sessions/${id}`, { method: "DELETE" }, "Failed to delete session");
}
