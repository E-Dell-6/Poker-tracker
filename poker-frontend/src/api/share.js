import { apiFetch } from "./http";

// Public share links are fetched without credentials on purpose (unlike
// most endpoints, which default to "include") - this reproduces the
// original fetch()'s implicit "same-origin" default exactly.
export async function getSharedHand(id) {
  const res = await apiFetch(`/api/share/${id}`, { credentials: "same-origin" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Server error");
  const { hand } = await res.json();
  return hand;
}

export async function createShareLink(hand, userId) {
  const res = await apiFetch("/api/share", { method: "POST", body: { hand, userId } });
  if (!res.ok) throw new Error(await res.text());
  const { shareId } = await res.json();
  return shareId;
}

export async function deleteShareLink(shareId, userId) {
  const res = await apiFetch(`/api/share/${shareId}`, { method: "DELETE", body: { userId } });
  if (!res.ok) throw new Error(await res.text());
}
