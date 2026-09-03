// Shared between every entry point that drives useHandImport (Layout's
// page-wide drop zone, History's file/folder pickers) so all of them
// describe the same job state the same way.
//
// A folder import has two distinct slow phases and they fail for different
// reasons, so they're reported separately rather than as one opaque
// "Processing..." - during upload the count is what moves, during
// processing it's the hand total.
export function describeImportProgress({ phase, filesTotal, filesUploaded, filesProcessed, handsImported }) {
  if (phase === 'screening') return 'Checking files...';
  if (phase === 'uploading') return `Uploading ${filesUploaded} of ${filesTotal} file(s)...`;
  if (phase === 'processing') {
    const hands = handsImported > 0 ? ` - ${handsImported.toLocaleString()} hands` : '';
    return `Importing ${filesProcessed} of ${filesTotal} file(s)${hands}...`;
  }
  return 'Working...';
}
