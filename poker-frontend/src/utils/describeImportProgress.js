// Shared between every entry point that drives useHandImport (Layout's
// page-wide drop zone, History's file/folder pickers) so all of them
// describe the same job state the same way.
//
// A folder import has two distinct slow phases and they fail for different
// reasons, so they're reported separately rather than as one opaque
// "Processing..." - during upload the count is what moves, during
// processing it's the hand total.
export function describeImportProgress({
  phase, filesTotal, filesUploaded, filesProcessed, handsImported, personsDone, personsTotal,
}) {
  if (phase === 'screening') return 'Checking files...';
  if (phase === 'uploading') return `Uploading ${filesUploaded} of ${filesTotal} file(s)...`;
  if (phase === 'processing') {
    const hands = handsImported > 0 ? ` - ${handsImported.toLocaleString()} hands` : '';
    return `Importing ${filesProcessed} of ${filesTotal} file(s)${hands}...`;
  }
  // Runs after every file is in, while stats for the opponents (and hero,
  // if touched) get rebuilt from the new hands - the one step left before
  // the job can report itself done. See importRunner.js.
  if (phase === 'finalizing') {
    return personsTotal > 0
      ? `Calculating stats for ${personsDone} of ${personsTotal} player(s)...`
      : 'Calculating stats...';
  }
  return 'Working...';
}
