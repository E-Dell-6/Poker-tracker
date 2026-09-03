import { apiFetch } from "./http";

// Staged bulk import (POST /api/imports), for folder-sized uploads.
//
// Files go up in sequential batches rather than one big request. The nginx
// in front of the API caps a request body at 32MB, and its 413 is an HTML
// page - so an over-sized request doesn't even produce a readable error.
// Batching well under that ceiling avoids the cliff entirely and gives
// honest progress, since fetch can't report progress within a single
// request.
//
// These limits mirror poker-backend/config/limits.js. They're duplicated
// deliberately: checking here means a user learns their folder is too big
// before uploading 100MB, and the server enforces the same numbers anyway
// because a client-side check is a courtesy, not a control.
export const IMPORT_LIMITS = {
  BYTES_PER_FILE: 10 * 1024 * 1024,
  FILES_PER_REQUEST: 25,
  BYTES_PER_REQUEST: 8 * 1024 * 1024,
  FILES_PER_JOB: 500,
  BYTES_PER_JOB: 100 * 1024 * 1024,
};

const IMPORT_FILE_PATTERN = /\.(csv|txt)$/i;

// Reads an error body defensively. nginx's 413 and any proxy-level failure
// return HTML, not JSON - parsing that blind throws a SyntaxError that
// surfaces to the user as "Unexpected token '<'".
async function errorFrom(res, fallback) {
  try {
    const body = await res.json();
    return body?.error || fallback;
  } catch {
    if (res.status === 413) return "That upload was too large for the server to accept.";
    if (res.status === 401) return "Your session expired. Please sign in again.";
    return `${fallback} (HTTP ${res.status})`;
  }
}

/**
 * Splits files into batches that respect both the per-request file count
 * and the per-request byte budget. A single file larger than the budget
 * still gets its own batch - the server's per-file limit is what rejects
 * it, with a message naming the file.
 */
export function planBatches(files) {
  const batches = [];
  let current = [];
  let currentBytes = 0;

  for (const file of files) {
    const wouldExceedCount = current.length + 1 > IMPORT_LIMITS.FILES_PER_REQUEST;
    const wouldExceedBytes = current.length > 0 && currentBytes + file.size > IMPORT_LIMITS.BYTES_PER_REQUEST;
    if (wouldExceedCount || wouldExceedBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += file.size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Client-side pre-flight. Returns { accepted, rejected } so the UI can
 * explain what it skipped before sending a single byte.
 */
export function screenFiles(files) {
  const accepted = [];
  const rejected = [];
  let runningBytes = 0;

  for (const file of files) {
    if (!IMPORT_FILE_PATTERN.test(file.name)) {
      rejected.push({ filename: file.name, error: "not a .csv or .txt file" });
    } else if (file.size === 0) {
      rejected.push({ filename: file.name, error: "file is empty" });
    } else if (file.size > IMPORT_LIMITS.BYTES_PER_FILE) {
      rejected.push({ filename: file.name, error: "larger than 10MB" });
    } else if (accepted.length >= IMPORT_LIMITS.FILES_PER_JOB) {
      rejected.push({ filename: file.name, error: `over the ${IMPORT_LIMITS.FILES_PER_JOB}-file limit` });
    } else if (runningBytes + file.size > IMPORT_LIMITS.BYTES_PER_JOB) {
      rejected.push({ filename: file.name, error: "over the 100MB total limit" });
    } else {
      accepted.push(file);
      runningBytes += file.size;
    }
  }

  return { accepted, rejected };
}

// Uploads one batch. Passing jobId appends to an existing job; omitting it
// creates one.
export async function stageBatch(files, jobId) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";
  const res = await apiFetch(`/api/imports${query}`, { method: "POST", body: formData });

  if (!res.ok) throw new Error(await errorFrom(res, "Upload failed"));
  return res.json();
}

export async function startImport(jobId) {
  const res = await apiFetch(`/api/imports/${jobId}/start`, { method: "POST" });
  if (!res.ok) throw new Error(await errorFrom(res, "Could not start import"));
  return res.json();
}

export async function getImportStatus(jobId) {
  const res = await apiFetch(`/api/imports/${jobId}`);
  if (!res.ok) throw new Error(await errorFrom(res, "Could not read import status"));
  return res.json();
}

export async function cancelImport(jobId) {
  const res = await apiFetch(`/api/imports/${jobId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorFrom(res, "Could not cancel import"));
  return res.json();
}

const TERMINAL_STATUSES = ["done", "failed", "cancelled"];
const POLL_INTERVAL_MS = 1000;
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Polls a job until it reaches a terminal status, calling onTick with each
 * response. Resolves with the final job.
 *
 * Deliberately a plain async function rather than a hook: the import
 * orchestrator drives it imperatively from inside an async flow, where a
 * hook can't be called.
 *
 * A transient network failure doesn't abort the import - the job keeps
 * running on the server regardless of whether anyone is watching - so
 * errors are tolerated up to MAX_CONSECUTIVE_ERRORS before giving up on
 * reporting.
 */
export async function pollImportUntilDone(jobId, onTick, { shouldStop } = {}) {
  let consecutiveErrors = 0;
  let last = null;

  for (;;) {
    if (shouldStop?.()) return last;

    try {
      last = await getImportStatus(jobId);
      consecutiveErrors = 0;
      onTick?.(last);
      if (TERMINAL_STATUSES.includes(last.status)) return last;
    } catch (err) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) throw err;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * Flattens a DataTransferItemList into a flat file list, walking into
 * dropped directories.
 *
 * A dropped folder appears in dataTransfer.files as a single unusable
 * directory entry, which is why folder drops silently failed before. The
 * entry API (webkitGetAsEntry) is the only way to see inside it.
 *
 * Depth and count are bounded because this walks whatever the user dropped
 * - a deep tree would otherwise spin here long before any limit is checked.
 */
export async function collectDroppedFiles(dataTransfer, { maxFiles = IMPORT_LIMITS.FILES_PER_JOB, maxDepth = 8 } = {}) {
  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter(Boolean);

  // No entry API (or a paste rather than a drop) - fall back to the flat
  // file list, which is all the old behavior ever used.
  if (entries.length === 0) return { files: Array.from(dataTransfer.files || []), truncated: false };

  const files = [];
  let truncated = false;

  const readDirectory = (reader) =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  const walk = async (entry, depth) => {
    if (files.length >= maxFiles) { truncated = true; return; }

    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      files.push(file);
      return;
    }

    if (entry.isDirectory && depth < maxDepth) {
      const reader = entry.createReader();
      // readEntries returns at most ~100 entries per call and must be
      // called repeatedly until it returns an empty batch.
      for (;;) {
        const batch = await readDirectory(reader);
        if (batch.length === 0) break;
        for (const child of batch) {
          await walk(child, depth + 1);
          if (files.length >= maxFiles) { truncated = true; return; }
        }
      }
    }
  };

  for (const entry of entries) {
    await walk(entry, 0);
    if (files.length >= maxFiles) { truncated = true; break; }
  }

  return { files, truncated };
}
