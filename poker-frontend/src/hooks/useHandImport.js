import { useCallback, useRef, useState } from "react";
import {
  screenFiles,
  planBatches,
  stageBatch,
  startImport,
  pollImportUntilDone,
  collectDroppedFiles,
  cancelImport,
  IMPORT_LIMITS,
} from "../api/imports";

// Shared upload-and-report logic behind every "Import hands" entry point
// (History's file picker and folder picker, and the page-wide drop zone
// in Layout).
//
// Uploads now go through the staged import flow (/api/imports) rather than
// one synchronous request: files are screened client-side, sent in batches
// that stay well under the proxy's body limit, then processed server-side
// as a job this hook polls. That's what makes a 30MB folder of ~20k hands
// viable - the old path put every file in one request and parsed them all
// inline before responding.
//
// `uploadStatus` keeps its original shape on purpose: History.jsx uses it
// as a useEffect dependency to refetch, and relies on the
// "success-<timestamp>" value changing to re-trigger that. Richer detail
// lives alongside it in `progress` rather than replacing it.

const initialProgress = {
  phase: "idle",        // idle | screening | uploading | processing | finalizing | done
  filesTotal: 0,
  filesUploaded: 0,
  filesProcessed: 0,
  handsImported: 0,
  handsSkipped: 0,
  personsDone: 0,
  personsTotal: 0,
  jobId: null,
};

export function useHandImport(onSettled) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(initialProgress);
  // Set when the user cancels, so both the upload loop and the poll stop.
  const cancelledRef = useRef(false);
  const jobIdRef = useRef(null);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    if (jobIdRef.current) {
      await cancelImport(jobIdRef.current).catch(() => {});
    }
  }, []);

  // Watches a job that is already running server-side and reports it to
  // completion. Split out of runImport because it's the whole of what a
  // reloaded page (or a second tab) can do: the upload phase needs the
  // File objects, which only the tab that picked them ever had, but the
  // job itself keeps running on the server and can be followed by anyone.
  const watchJob = useCallback(async (jobId, { messageParts = [] } = {}) => {
    jobIdRef.current = jobId;
    try {
      const job = await pollImportUntilDone(
        jobId,
        (tick) => {
          // Every file can report done - filesDone === filesTotal - while
          // the job is still very much working: one stats recompute runs
          // after the last file and before the job reports itself 'done'
          // (see importRunner.js). Without distinguishing that stage here,
          // the progress card would freeze on "120/120 files" for however
          // long that takes, which reads as hung rather than working.
          const finalizing = tick.progress?.stage === "finalizing";
          setProgress((p) => ({
            ...p,
            phase: finalizing ? "finalizing" : "processing",
            // A watcher that didn't do the uploading learns the file count
            // from the job itself.
            filesTotal: p.filesTotal || tick.totalFiles || 0,
            filesProcessed: tick.progress?.filesDone ?? 0,
            handsImported: tick.progress?.handsImported ?? 0,
            handsSkipped: tick.progress?.handsSkipped ?? 0,
            personsDone: tick.progress?.personsDone ?? 0,
            personsTotal: tick.progress?.personsTotal ?? 0,
          }));
        },
        { shouldStop: () => cancelledRef.current }
      );

      if (job?.status === "failed") {
        setUploadStatus("error");
        setError(job.error || "Import failed.");
        return;
      }

      // Reachable via another tab (or this one) cancelling the job while
      // this poll was watching it.
      if (job?.status === "cancelled") {
        setUploadStatus("error");
        setError("Import cancelled.");
        return;
      }

      // Per-file outcomes only matter when something went wrong; a clean
      // import just reports its totals.
      const failed = (job?.files || []).filter((f) => f.status === "failed");
      const skipped = (job?.files || []).filter((f) => f.status === "skipped");

      if (failed.length > 0) {
        messageParts.push(
          failed.length <= 3
            ? failed.map((f) => `${f.originalName}: ${f.error}`).join(" | ")
            : `${failed.length} files could not be imported.`
        );
      }
      if (skipped.length > 0) {
        messageParts.push(
          skipped.length === 1
            ? "1 file was already uploaded."
            : `${skipped.length} files were already uploaded.`
        );
      }

      const importedHands = job?.progress?.handsImported ?? 0;
      const dedupedHands = job?.progress?.handsSkipped ?? 0;
      if (dedupedHands > 0) {
        messageParts.push(`${dedupedHands.toLocaleString()} duplicate hand(s) skipped.`);
      }

      setProgress((p) => ({
        ...p,
        phase: "done",
        filesProcessed: job?.progress?.filesDone ?? p.filesProcessed,
        handsImported: importedHands,
      }));

      if (messageParts.length > 0) setError(messageParts.join(" "));
      setUploadStatus("success-" + Date.now());
    } catch (err) {
      setUploadStatus("error");
      setError(err.message);
    }
  }, []);

  // Picks up a job reported by GET /api/imports/active - i.e. one this tab
  // never started, because the page was reloaded or opened fresh while an
  // import was already running.
  const adoptJob = useCallback(async (job) => {
    if (!job?.jobId) return;
    cancelledRef.current = false;
    setError(null);
    setUploadStatus("uploading");
    setProgress({
      ...initialProgress,
      phase: job.progress?.stage === "finalizing" ? "finalizing" : "processing",
      filesTotal: job.totalFiles || 0,
      // Whatever this job still has to do, its bytes are all on the server
      // already - there is no upload phase left to report.
      filesUploaded: job.totalFiles || 0,
      filesProcessed: job.progress?.filesDone ?? 0,
      handsImported: job.progress?.handsImported ?? 0,
      handsSkipped: job.progress?.handsSkipped ?? 0,
      personsDone: job.progress?.personsDone ?? 0,
      personsTotal: job.progress?.personsTotal ?? 0,
      jobId: job.jobId,
    });
    try {
      await watchJob(job.jobId);
    } finally {
      onSettled?.();
    }
  }, [watchJob, onSettled]);

  const runImport = useCallback(async (fileList, { preScreened } = {}) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    cancelledRef.current = false;
    jobIdRef.current = null;
    setError(null);
    setUploadStatus("uploading");
    setProgress({ ...initialProgress, phase: "screening" });

    // Screen before uploading anything, so a folder with 400 unrelated
    // files tells the user immediately instead of after 100MB of transfer.
    const { accepted, rejected } = preScreened || screenFiles(incoming);

    if (accepted.length === 0) {
      setUploadStatus("error");
      setError(
        rejected.length === 1
          ? `${rejected[0].filename}: ${rejected[0].error}`
          : `No importable files found. Expected .csv or .txt hand history exports.`
      );
      onSettled?.();
      return;
    }

    const messageParts = [];
    if (rejected.length > 0) {
      messageParts.push(
        rejected.length === 1
          ? `Skipped ${rejected[0].filename} (${rejected[0].error}).`
          : `Skipped ${rejected.length} file(s) that weren't importable.`
      );
    }

    try {
      const batches = planBatches(accepted);
      setProgress((p) => ({ ...p, phase: "uploading", filesTotal: accepted.length }));

      // Sequential, not parallel: the point of batching is to keep each
      // request small and the server unsurprised, not to saturate the link.
      let jobId = null;
      let uploaded = 0;
      const serverRejected = [];

      for (const batch of batches) {
        if (cancelledRef.current) break;
        const result = await stageBatch(batch, jobId);
        jobId = result.jobId;
        jobIdRef.current = jobId;
        if (result.rejected?.length) serverRejected.push(...result.rejected);
        uploaded += batch.length;
        setProgress((p) => ({ ...p, filesUploaded: uploaded, jobId }));
      }

      if (cancelledRef.current) {
        await cancelImport(jobId).catch(() => {});
        setUploadStatus("error");
        setError("Import cancelled.");
        return;
      }

      // The server rejects on content, not filename - a .txt full of
      // something else is caught there, not by screenFiles.
      if (serverRejected.length > 0) {
        messageParts.push(
          serverRejected.length === 1
            ? `${serverRejected[0].filename}: ${serverRejected[0].error}`
            : `${serverRejected.length} file(s) weren't recognized as hand histories.`
        );
      }

      await startImport(jobId);
      setProgress((p) => ({ ...p, phase: "processing" }));

      await watchJob(jobId, { messageParts });
    } catch (err) {
      setUploadStatus("error");
      setError(err.message);
    } finally {
      onSettled?.();
    }
  }, [onSettled, watchJob]);

  // Click-driven picker (files or a folder). The input already filters by
  // accept=, but a folder picker returns everything inside it, so
  // screenFiles still does the real work.
  const uploadFiles = useCallback((fileList) => runImport(fileList), [runImport]);

  // Drop target. Walks into dropped directories, which the old
  // dataTransfer.files path could not do - a dropped folder arrived as a
  // single directory entry that failed the extension filter, so folder
  // drops always reported "Please drop a .csv or .txt log file".
  const uploadDroppedFiles = useCallback(async (dataTransfer) => {
    // Tolerate being handed a plain FileList (the previous signature).
    if (!dataTransfer || typeof dataTransfer !== "object" || !("items" in dataTransfer)) {
      return runImport(dataTransfer);
    }

    setProgress({ ...initialProgress, phase: "screening" });
    const { files, truncated } = await collectDroppedFiles(dataTransfer);

    if (files.length === 0) {
      setError("Please drop .csv or .txt hand history files, or a folder containing them.");
      return;
    }

    const screened = screenFiles(files);
    if (truncated) {
      screened.rejected.push({
        filename: `${IMPORT_LIMITS.FILES_PER_JOB}+ files`,
        error: `only the first ${IMPORT_LIMITS.FILES_PER_JOB} were taken`,
      });
    }
    return runImport(files, { preScreened: screened });
  }, [runImport]);

  return {
    uploadStatus, setUploadStatus,
    error, setError,
    progress,
    cancel,
    uploadFiles,
    uploadDroppedFiles,
    adoptJob,
  };
}
