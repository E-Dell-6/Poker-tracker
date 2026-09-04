import { useEffect } from 'react';
import { useImport } from '../context/ImportContext';
import { describeImportProgress } from '../utils/describeImportProgress';
import './ImportStatus.css';

// How long a finished import's summary (or failure) stays up before it
// clears itself. It used to disappear on navigation, because it lived in
// Layout and Layout unmounts - now that it's app-wide, nothing would ever
// take it off screen.
const SETTLED_MESSAGE_MS = 12000;

// Rendered once, next to <Routes> rather than inside <Layout>, so an
// import reports itself on every page - including pages with no "Import
// hands" CTA of their own, and pages you navigate to while it runs. Both
// elements are position:fixed, so where they sit in the tree doesn't
// affect where they land on screen.
export function ImportStatus() {
  const { uploadStatus, error, setError, progress } = useImport();
  const isRunning = uploadStatus === 'uploading';

  useEffect(() => {
    // While the import is still running the message is context for the
    // progress card next to it (e.g. "skipped 3 files"), so it stays.
    if (!error || isRunning) return;
    const timer = setTimeout(() => setError(null), SETTLED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [error, isRunning, setError]);

  return (
    <>
      {isRunning && (
        <div className="import-status-card" role="status" aria-live="polite">
          {describeImportProgress(progress)}
        </div>
      )}
      {error && (
        <button
          type="button"
          className="import-status-error"
          onClick={() => setError(null)}
          title="Dismiss"
        >
          {error}
        </button>
      )}
    </>
  );
}

export default ImportStatus;
