import { apiFetch } from "./http";

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await apiFetch("/api/upload-image", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to upload image");
  }
  const { imageUrl } = await res.json();
  return imageUrl;
}

// Returns the raw {results:[...]} body untouched - callers own their own
// per-file success/duplicate/error message-building.
export async function uploadSessionCsv(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("csvFile", file));
  const res = await apiFetch("/api/upload", { method: "POST", body: formData });

  // Guarded because a failure here isn't always JSON: the proxy in front of
  // the API answers an over-sized body with an HTML 413, and parsing that
  // blind throws a SyntaxError that reaches the user as
  // "Unexpected token '<'" instead of anything about the upload.
  let result;
  try {
    result = await res.json();
  } catch {
    if (res.status === 413) throw new Error("That upload was too large for the server to accept.");
    if (res.status === 401) throw new Error("Your session expired. Please sign in again.");
    throw new Error(`Upload failed (HTTP ${res.status})`);
  }

  if (!res.ok && !result.results) {
    throw new Error(result.error || "Upload failed");
  }
  return result;
}
