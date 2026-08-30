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
  const result = await res.json();
  if (!res.ok && !result.results) {
    throw new Error(result.error || "Upload failed");
  }
  return result;
}
