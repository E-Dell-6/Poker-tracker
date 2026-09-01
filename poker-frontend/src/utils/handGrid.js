// Rank order + 169-hand-class token builder for the range-matrix grid
// (PreflopMatrix/HandMatrix.jsx). Tokens match the backend's exact format
// (poker-backend/utils/handClass.js's classifyHoleCards: "AA" pair, "AKs"
// suited, "AKo" offsuit) so grid cells key straight into the
// stats.preflopMatrix API response with no translation layer.

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// Fixed 6-max position order for the range-matrix control bar - matches
// statsEngine.js's POSITIONS_BY_SIZE[6] and the reference UI's bottom bar
// (UTG/HJ/CO/BTN/SB/BB), since the backend only aggregates preflopMatrix
// for tableSize === 6.
export const HERO_POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

// rowRank/colRank are both from RANKS, higher-ranked first (index 0 = Ace).
// Diagonal (same rank) = pocket pair. Upper-right triangle (row index <
// col index, i.e. rowRank higher than colRank) = suited. Lower-left
// triangle = offsuit - by poker-range-grid convention, the higher-ranked
// card leads the token either way ("AKs"/"AKo", never "KAs").
export function handToken(rowRank, colRank) {
  const rowIdx = RANKS.indexOf(rowRank);
  const colIdx = RANKS.indexOf(colRank);
  if (rowIdx === colIdx) return `${rowRank}${rowRank}`;
  const [hi, lo] = rowIdx < colIdx ? [rowRank, colRank] : [colRank, rowRank];
  return rowIdx < colIdx ? `${hi}${lo}s` : `${hi}${lo}o`;
}
