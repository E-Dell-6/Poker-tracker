import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { useHandImport } from '../hooks/useHandImport';
import { describeImportProgress } from '../utils/describeImportProgress';
import "./Layout.css";

// Any page that shows the "Import hands" CTA also gets page-wide
// drag-and-drop: dropping files OR a folder anywhere in the layout
// (sidebar, header, or main content, not just a page-specific drop zone)
// uploads them the same way the CTA's own file picker does. Gated on the
// label rather than a separate prop so every such page gets this for free -
// a page opts in simply by asking for the "Import hands" button.
const IMPORT_CTA_LABEL = 'Import hands';

export function Layout({ title, subtitle, ctaLabel, ctaIcon, onCta, ctaMenu, onImportSettled, children }) {
  const isImportPage = ctaLabel === IMPORT_CTA_LABEL;
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const { uploadStatus, error, progress, uploadDroppedFiles } = useHandImport(onImportSettled);

  const handleDragEnter = (event) => {
    if (!isImportPage) return;
    event.preventDefault();
    if (uploadStatus === 'uploading') return;
    setIsDraggingFile(true);
  };

  const handleDragOver = (event) => {
    if (!isImportPage) return;
    event.preventDefault();
  };

  const handleDragLeave = (event) => {
    if (!isImportPage) return;
    event.preventDefault();
    // Only clear once the pointer actually leaves the layout, not when it
    // moves over a child element inside it.
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = async (event) => {
    if (!isImportPage) return;
    event.preventDefault();
    setIsDraggingFile(false);
    if (uploadStatus === 'uploading') return;
    // The whole dataTransfer, not .files: a dropped FOLDER shows up in
    // .files as one unusable directory entry, so folder drops always
    // failed the extension check. The hook walks .items instead.
    await uploadDroppedFiles(event.dataTransfer);
  };

  const displayedCtaLabel = isImportPage && uploadStatus === 'uploading' ? 'Processing...' : ctaLabel;

  return (
    <div
      className="app-layout"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar />
      <div className="app-layout-column">
        {title && <TopHeader title={title} subtitle={subtitle} ctaLabel={displayedCtaLabel} ctaIcon={ctaIcon} onCta={onCta} ctaMenu={ctaMenu} />}
        <main className="main-content">
          {children}
        </main>
      </div>

      {isImportPage && isDraggingFile && (
        <div className="layout-drop-overlay">Drop .csv / .txt files or a folder to upload</div>
      )}
      {isImportPage && uploadStatus === 'uploading' && (
        <div className="layout-upload-progress">{describeImportProgress(progress)}</div>
      )}
      {isImportPage && error && (
        <div className="layout-upload-error">{error}</div>
      )}
    </div>
  );
}

export default Layout;
