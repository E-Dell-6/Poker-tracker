import { apiFetch } from "./http";

// No ok-check - every caller branches on the JSON body's `success` flag,
// never res.ok (4xx responses here carry a valid {success:false} body).
export async function getUserData() {
  const res = await apiFetch("/api/user/data");
  return res.json();
}
