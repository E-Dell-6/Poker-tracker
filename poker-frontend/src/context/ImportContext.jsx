import { createContext, useContext, useEffect, useRef } from 'react';
import { useHandImport } from '../hooks/useHandImport';
import { getActiveImport } from '../api/imports';

const ImportContext = createContext(null);

// ONE import per app, owned above the router.
//
// Every entry point (History's file/folder pickers, the page-wide drop
// zone in Layout) and the status card that reports them now share this
// single useHandImport instance. Before, each of those built its own: a
// CTA-driven upload and a dropped folder were separate states that
// couldn't see each other, and both died the moment you navigated to
// another page, because the state lived in the page component that
// started it. Living above <Routes>, this survives navigation, so the
// progress card stays up on every page until the import finishes.
//
// A reload is the other half: nothing in the browser survives that, but
// the job itself doesn't live in the browser - it's queued server-side and
// keeps running regardless of who's watching. So on mount we ask the
// server whether this user has one in flight and pick it back up.
export function ImportProvider({ children }) {
  const importState = useHandImport();
  const { uploadStatus, progress, adoptJob } = importState;
  // StrictMode runs mount effects twice in dev; adopting twice would open
  // two polls against the same job.
  const adoptedRef = useRef(false);

  useEffect(() => {
    if (adoptedRef.current) return;
    adoptedRef.current = true;

    let cancelled = false;
    getActiveImport().then((job) => {
      if (job && !cancelled) adoptJob(job);
    });
    return () => { cancelled = true; };
  }, [adoptJob]);

  // The one phase a reload genuinely destroys: while batches are still
  // going up, the files exist only as File objects in this tab, and the
  // job sits in 'staging' server-side - it will never start on its own.
  // Everything after /start is safe to walk away from, so the prompt is
  // scoped to just those phases rather than the whole import.
  const isUploadingBytes =
    uploadStatus === 'uploading' &&
    (progress.phase === 'screening' || progress.phase === 'uploading');

  useEffect(() => {
    if (!isUploadingBytes) return;
    const warn = (event) => {
      event.preventDefault();
      // Browsers show their own generic wording; a non-empty returnValue
      // is what still triggers the prompt in Chrome/Safari.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isUploadingBytes]);

  return <ImportContext.Provider value={importState}>{children}</ImportContext.Provider>;
}

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error('useImport must be used within an ImportProvider');
  return ctx;
}
