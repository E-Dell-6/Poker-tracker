// Currency per parser format; add new sites here + Session schema enum.
//
// Lives here rather than in sessionImportService so both the inline upload
// path and the bulk import runner can read it without importing each
// other.
export const FORMAT_CURRENCY = {
  ACR: 'USD',
  GGPOKER: 'CAD',
  POKERNOW: 'CHIPS',
};
