import { API_URL } from "../config";

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// Builds the absolute URL, defaults credentials to "include", JSON-encodes
// a plain-object body, leaves FormData untouched. Returns the raw Response
// for callers that need to branch on res.status/res.ok themselves.
export async function apiFetch(path, { method, headers, body, credentials, ...rest } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders = { ...headers };
  let finalBody = body;
  if (body !== undefined && !isFormData) {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json";
    finalBody = JSON.stringify(body);
  }
  return fetch(`${API_URL}${path}`, {
    method,
    headers: Object.keys(finalHeaders).length ? finalHeaders : undefined,
    body: finalBody,
    credentials: credentials ?? "include",
    ...rest,
  });
}

// Throw-if-!ok + parse. errorMessage preserves each call site's original
// user-facing wording.
export async function parseJson(res, errorMessage) {
  if (!res.ok) {
    let body;
    try {
      body = await res.json();
    } catch {
      // non-JSON or empty error body - leave body undefined
    }
    throw new ApiError(errorMessage || `Request failed (${res.status})`, { status: res.status, body });
  }
  if (res.status === 204) return null;
  return res.json();
}

// Convenience: fetch + parseJson in one call.
export async function requestJson(path, options, errorMessage) {
  return parseJson(await apiFetch(path, options), errorMessage);
}
