// Display constants shared by the range-matrix page's grid (HandMatrix), the
// line's seat cards (PreflopMatrixControls) and the side panel
// (RangeSidePanel).

// The three preflop actions in display order. `pctKey` reads both shapes
// those components consume: an API cell (statsEngine.js's
// finalizeMatrixCell) and a whole-node aggregate (preflopWalk.js's
// summarizeBucket) - they share fold/call/raise/total and the *Pct keys.
// Colors live in theme.css's --color-action-* tokens.
export const ACTIONS = [
  { key: 'fold', label: 'Fold', pctKey: 'foldPct', color: 'var(--color-action-fold)' },
  { key: 'call', label: 'Call', pctKey: 'callPct', color: 'var(--color-action-call)' },
  { key: 'raise', label: 'Raise', pctKey: 'raisePct', color: 'var(--color-action-raise)' }
];

// "1 hand" / "1,284 hands"
export function formatHandCount(n) {
  return `${n.toLocaleString()} ${n === 1 ? 'hand' : 'hands'}`;
}
