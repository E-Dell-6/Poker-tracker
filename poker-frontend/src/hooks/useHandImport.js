import { useState } from "react";
import { uploadSessionCsv } from "../api/uploads";

const IMPORT_FILE_PATTERN = /\.(csv|txt)$/i;

// Shared upload-and-report logic behind every "Import hands" entry point
// (History's file picker, and the page-wide drop zone in Layout) - keeps
// the network call, the per-file success/duplicate/failure summary, and
// status bookkeeping in one place so every call site reports results
// identically. `onSettled` fires after each attempt (success or failure)
// so a page can refresh whatever data it shows without needing to own
// this hook's state itself (Layout's page-wide drop uses its own
// instance, separate from a page's own click-driven upload).
export function useHandImport(onSettled) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [error, setError] = useState(null);

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setError(null);
    setUploadStatus("uploading");

    try {
      const result = await uploadSessionCsv(files);

      const perFileResults = result.results || [];
      const duplicates = perFileResults.filter((r) => !r.success && r.duplicate);
      const otherFailures = perFileResults.filter((r) => !r.success && !r.duplicate);
      const successCount = perFileResults.filter((r) => r.success).length;

      const messageParts = [];
      if (otherFailures.length > 0) {
        // Real errors are rarer and need attention, so name the files.
        const names = otherFailures.map((f) => `${f.filename}: ${f.error}`).join(" | ");
        messageParts.push(names);
      }
      if (duplicates.length > 0) {
        messageParts.push(
          duplicates.length === 1
            ? "1 file was already uploaded."
            : `${duplicates.length} files were already uploaded.`
        );
      }
      if (successCount > 0 && (duplicates.length > 0 || otherFailures.length > 0)) {
        messageParts.unshift(
          `Uploaded ${successCount} of ${files.length} file(s).`
        );
      }

      if (messageParts.length > 0) {
        setError(messageParts.join(" "));
      }

      setUploadStatus("success-" + Date.now());
    } catch (err) {
      setUploadStatus("error");
      setError(err.message);
    } finally {
      onSettled?.();
    }
  };

  const uploadDroppedFiles = async (fileList) => {
    const dropped = Array.from(fileList || []).filter((f) =>
      IMPORT_FILE_PATTERN.test(f.name)
    );
    if (dropped.length === 0) {
      setError("Please drop a .csv or .txt log file.");
      return;
    }
    await uploadFiles(dropped);
  };

  return { uploadStatus, setUploadStatus, error, setError, uploadFiles, uploadDroppedFiles };
}
