import { apiFetch, requestJson } from "./http";

export async function getMyStats() {
  const res = await apiFetch("/api/stats/me");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function getMyFilteredStats({ stakes, from } = {}) {
  const params = new URLSearchParams();
  if (stakes) params.set("stakes", stakes);
  if (from) params.set("from", from);
  return requestJson(`/api/stats/me/filtered?${params.toString()}`, {}, "Failed to load filtered stats");
}

export async function recomputeMyStats() {
  return requestJson("/api/stats/me/recompute", { method: "POST", body: {} }, "Failed to recompute stats");
}

export async function getPlayersStats() {
  const res = await apiFetch("/api/stats/players");
  const data = res.ok ? await res.json() : [];
  return Array.isArray(data) ? data : [];
}

export async function getPersonStats(personId) {
  const res = await apiFetch(`/api/stats/person/${personId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function recomputePersonStats(personId) {
  return requestJson(`/api/stats/person/${personId}/recompute`, { method: "POST" }, "Failed to recompute stats");
}

export async function getEvGraph({ stakes, from, to } = {}) {
  const params = new URLSearchParams();
  if (stakes) params.set("stakes", stakes);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const data = await requestJson(`/api/stats/me/ev-graph${qs ? `?${qs}` : ""}`, {}, "Failed to load EV graph");
  return Array.isArray(data) ? data : [];
}
