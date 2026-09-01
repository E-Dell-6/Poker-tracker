// Rank order + 169-hand-class token builder for the range-matrix grid
// (PreflopMatrix/HandMatrix.jsx). Tokens match the backend's exact format
// (poker-backend/utils/handClass.js's classifyHoleCards: "AA" pair, "AKs"
// suited, "AKo" offsuit) so grid cells key straight into the
// stats.preflopMatrix API response with no translation layer.

export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// Preflop acting order (not seating order) for each table size the
// range-matrix supports - matches statsEngine.js's POSITIONS_BY_SIZE, just
// reordered to "who acts first" (UTG) through "who closes the action" (BB)
// instead of that array's dealer-relative-offset order. The backend only
// aggregates preflopMatrix for tableSize 6-9 (see its own gate comment).
export const SEATS_BY_SIZE = {
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
};
export const TABLE_SIZES = [6, 7, 8, 9];

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

// Mirrors statsEngine.js's matrixScenarioForLevel: 'rfi' = level 0, 'vsOpen'
// = level 1, and every deeper scenario is named 'vs<N>Bet' where N = level+1
// (a 3-bet is level 2, a 4-bet level 3, ...). Unbounded - a hand can 5-bet,
// 6-bet, 7-bet jam, etc., and stats.preflopMatrix carries a key for
// whichever of those actually occurred in hero's tracked hands.
export function levelForScenario(scenario) {
  if (scenario === 'rfi') return 0;
  if (scenario === 'vsOpen') return 1;
  const m = /^vs(\d+)Bet$/.exec(scenario);
  return m ? Number(m[1]) - 1 : Infinity;
}

export function labelForScenario(scenario) {
  if (scenario === 'rfi') return 'RFI';
  if (scenario === 'vsOpen') return 'vs Open';
  const m = /^vs(\d+)Bet$/.exec(scenario);
  return m ? `vs ${m[1]}-Bet` : scenario;
}

// Inverse of levelForScenario - given a raise count, the scenario name for
// facing it. Mirrors statsEngine.js's matrixScenarioForLevel exactly.
export function scenarioForLevel(level) {
  if (level === 0) return 'rfi';
  if (level === 1) return 'vsOpen';
  return `vs${level + 1}Bet`;
}
