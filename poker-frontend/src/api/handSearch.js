import { requestJson } from "./http";

export async function searchHands({ gameType, result, filter, position, holeCards }) {
  const params = new URLSearchParams();
  if (gameType) params.set("gameType", gameType);
  if (result) params.set("result", result);
  if (filter) params.set("filter", filter);
  if (position) params.set("position", position);
  if (holeCards) params.set("holeCards", holeCards);

  const data = await requestJson(`/api/hands/search?${params.toString()}`, {}, "Search failed");
  return Array.isArray(data.hands) ? data.hands : [];
}
