import { apiFetch, requestJson } from "./http";

// No ok-check, matching 4 of 5 original call sites (only PlayerSeat.jsx
// guarded with `if (response.ok)`; its outer try/catch already produces
// the same silent-failure outcome as that guard did).
export async function getPeople() {
  const res = await apiFetch("/api/people");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// No ok-check, matching the original call site exactly - callers already
// handle a malformed/empty body via their own Array.isArray() guards.
export async function getPeoplePage({ page, limit, search, starred }) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  if (starred) params.set("starred", "true");
  const res = await apiFetch(`/api/people?${params.toString()}`);
  return res.json();
}

// `starred` is opt-in (omit or pass false for the default unstarred
// person) - EditSessionLog.jsx passes true, since its player picker only
// shows starred players and a freshly created one needs to appear there.
export async function createPerson({ name, image, starred }) {
  return requestJson("/api/people", { method: "POST", body: { name, image, starred } }, "Failed to create person");
}

export async function updatePerson(id, patch) {
  return requestJson(`/api/people/${id}`, { method: "PATCH", body: patch }, "Failed to update player");
}

export async function updatePersonNotes(id, notes) {
  return requestJson(`/api/people/${id}/notes`, { method: "POST", body: { notes } }, "Failed to update notes");
}

export async function addPersonTag(id, { label, color }) {
  return requestJson(`/api/people/${id}/tags`, { method: "POST", body: { label, color } }, "Failed to create tag");
}

export async function getPersonStarredItems(id) {
  return requestJson(`/api/people/${id}/starred`, {}, "Failed to load starred items");
}
