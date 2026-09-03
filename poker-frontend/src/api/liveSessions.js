import { apiFetch, parseJson, requestJson } from "./http";

// These two run app-wide (the sidebar's live-session state loads on every
// page), so a signed-out visitor hits them routinely. That's an empty
// state, not an error, and neither should throw.
//
// userAuth now answers an unauthenticated request with 401 rather than the
// 200 + { success: false } it used to send, so the status is what's
// checked. The body-shape check is kept alongside it: a browser running a
// cached copy of the old frontend, or a request in flight across a deploy,
// can still see the old 200 sentinel, and a genuine live-sessions response
// never has a `success` field (it's the raw array/document/null) - so the
// check stays unambiguous.
function isAuthFailure(data) {
  return !!data && data.success === false;
}

async function getOrEmpty(path, errorMessage, emptyValue) {
  const res = await apiFetch(path);
  if (res.status === 401) return emptyValue;
  const data = await parseJson(res, errorMessage);
  return isAuthFailure(data) ? emptyValue : data;
}

export async function getLiveSessions() {
  return getOrEmpty("/api/live-sessions", "Failed to load sessions", []);
}

export async function getActiveLiveSession() {
  return getOrEmpty("/api/live-sessions/active", "Failed to check active session", null);
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
