import { requestJson } from "./http";

export async function getLiveSessions() {
  return requestJson("/api/live-sessions", {}, "Failed to load sessions");
}

export async function getActiveLiveSession() {
  return requestJson("/api/live-sessions/active", {}, "Failed to check active session");
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
