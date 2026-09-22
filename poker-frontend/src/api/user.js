import { apiFetch } from "./http";

// No ok-check - every caller branches on the JSON body's `success` flag,
// never res.ok (4xx responses here carry a valid {success:false} body).
export async function getUserData() {
  const res = await apiFetch("/api/user/data");
  return res.json();
}

// Returns null rather than throwing on any failure - storage usage is
// supplementary, so the Profile page renders without the card instead of
// breaking when this call fails.
export async function getStorageUsage() {
  const res = await apiFetch("/api/user/storage");
  const data = await res.json();
  return data?.success ? data.storage : null;
}
