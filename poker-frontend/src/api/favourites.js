import { apiFetch, requestJson } from "./http";

export async function getFavourites() {
  const data = await requestJson("/api/favourites");
  return Array.isArray(data) ? data : [];
}

export async function toggleFavourite(handId) {
  return requestJson(
    `/api/favourites/${handId}`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    "Failed to toggle favourite"
  );
}

// No ok-check, matching FavouritesLog.jsx's original bare `await fetch` -
// only a network-level rejection should trigger its optimistic-UI revert.
export async function removeFavourite(handId) {
  await apiFetch(`/api/favourites/${handId}`, { method: "DELETE" });
}

export async function saveFavouriteHand(placeholderId, hand) {
  return requestJson(`/api/favourites/${placeholderId}`, { method: "POST", body: hand }, "Failed to save hand");
}
