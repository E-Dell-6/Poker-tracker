import { requestJson } from "./http";

export async function searchHands({ gameType, result, filter, position, holeCards, handClass, limit }) {
  const params = new URLSearchParams();
  if (gameType) params.set("gameType", gameType);
  if (result) params.set("result", result);
  if (filter) params.set("filter", filter);
  if (position) params.set("position", position);
  if (holeCards) params.set("holeCards", holeCards);
  if (handClass) params.set("handClass", handClass);
  if (limit) params.set("limit", limit);

  const data = await requestJson(`/api/hands/search?${params.toString()}`, {}, "Search failed");
  return Array.isArray(data.hands) ? data.hands : [];
}
