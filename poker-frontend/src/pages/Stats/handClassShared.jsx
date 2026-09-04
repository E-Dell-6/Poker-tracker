import { ChevronRight } from 'lucide-react';
import { Tag } from '../../components/ui/Tag';
import { formatSignedMajorUnits } from '../../utils/formatMoney';
import { confidenceModifier } from '../../utils/confidence';
import './handClassShared.css';

// Shared between HandClassBreakdown (the category -> hand table + per-hand
// detail panel) and HandClassLeaks (the ranked "biggest leaks" list across
// every hand) - both read stats.byHandClass/byHandClassCategory (see
// statsEngine.js's finalizeHandClassCategoryMap/finalizeHandClassMap).

export const CATEGORY_ORDER = [
  ['pocketPairs', 'Pocket pairs'],
  ['axSuited', 'Ax suited'],
  ['suitedBroadway', 'Suited broadway'],
  ['suitedConnectors', 'Suited connectors'],
  ['offsuitBroadway', 'Offsuit broadway'],
  ['offsuitGappers', 'Offsuit gappers'],
  ['other', 'Other']
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORY_ORDER);

// Matches classifyHeroPreflopContext's key set (statsEngine.js) - ordered
// as an "aggression ladder" (raises, then calls, then passive, then folds)
// rather than the order the backend happens to check them in.
export const CONTEXT_ORDER = [
  ['open', 'Open'],
  ['threeBet', '3-Bet'],
  ['fourBet', '4-Bet'],
  ['fiveBet', '5-Bet+'],
  ['coldCall', 'Call vs Open'],
  ['callVs3Bet', 'Call vs 3-Bet'],
  ['callVs4Bet', 'Call vs 4-Bet+'],
  ['limp', 'Limp'],
  ['checkedOption', 'Checked Option'],
  ['foldTo3Bet', 'Fold to 3-Bet'],
  ['foldTo4Bet', 'Fold to 4-Bet'],
  ['foldPreflop', 'Fold Preflop']
];

export const POSITION_ORDER = ['BTN', 'BTN/SB', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'];
export function sortPositions(positions) {
  return [...positions].sort((a, b) => {
    const ia = POSITION_ORDER.indexOf(a);
    const ib = POSITION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// Matches handClass.js's RANK_LABELS token format ("22".."AA").
const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

// Pocket pairs read naturally low-to-high (22 -> AA); every other category
// keeps the existing most-played-first ordering.
export function sortHandEntries(catKey, entries) {
  if (catKey === 'pocketPairs') {
    return [...entries].sort((a, b) => RANK_VALUE[a[0][0]] - RANK_VALUE[b[0][0]]);
  }
  return [...entries].sort((a, b) => b[1].hands - a[1].hands);
}

// These buckets are plain profit accumulators (see statsEngine.js's
// finalizeProfitLoss) - they don't carry a server-computed `confidence`
// field the way finalizeRate()-based stats do. Recompute the same tier
// client-side from `hands`, mirroring confidence.js's CONFIDENCE_PROFILES
// .default (low < 30, medium < 100), so confidenceModifier() below applies
// the same low-confidence/medium-confidence dimming used everywhere else.
export function sampleConfidence(hands) {
  if (hands < 30) return 'low';
  if (hands < 100) return 'medium';
  return 'high';
}

export function ProfitValue({ bucket }) {
  if (!bucket || bucket.hands === 0) return <span className="hcb-value-empty">—</span>;
  // Unlike bb100 (null when a bucket mixes currencies or has no bb-size
  // data), totalProfitLoss is always a real number - it's already
  // normalized to major units per-hand before summing (see
  // statsEngine.js's bumpProfit). The only genuine "nothing to show" case
  // left is a bucket with hands but literally no profit data recorded.
  if (bucket.handsWithProfitData === 0) return <span className="hcb-value-empty">n/a</span>;
  return (
    <span className={`hcb-value-mono ${bucket.totalProfitLoss >= 0 ? 'hcb-value-pos' : 'hcb-value-neg'}`}>
      {formatSignedMajorUnits(bucket.totalProfitLoss, bucket.currency)}
    </span>
  );
}

export function RateValue({ bucket }) {
  if (!bucket || bucket.hands === 0 || bucket.bb100 == null) {
    return <span className="hcb-value-empty">—</span>;
  }
  const modifier = confidenceModifier({ confidence: sampleConfidence(bucket.hands) });
  return (
    <span className={`hcb-value-mono hcb-rate ${bucket.bb100 >= 0 ? 'hcb-value-pos' : 'hcb-value-neg'} ${modifier ? `hcb-rate--${modifier}` : ''}`}>
      {bucket.bb100 >= 0 ? '+' : ''}{bucket.bb100.toFixed(1)}
    </span>
  );
}

export function Toggle({ expanded }) {
  return <ChevronRight size={14} className={`hcb-toggle ${expanded ? 'hcb-toggle--expanded' : ''}`} />;
}

export function toggleInSet(set, key) {
  const next = new Set(set);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

// Color + label for a position badge - prefers bb100 (the real win-rate
// figure) and only falls back to a bare hand count for the rare bucket
// with hands but no bb100 (no parseable bb size in the hand's stakes).
function positionBadgeColor(bucket) {
  if (bucket.bb100 != null) return bucket.bb100 >= 0 ? 'var(--color-positive)' : 'var(--color-negative)';
  return 'var(--color-text-faint)';
}
function positionBadgeLabel(pos, bucket) {
  if (bucket.bb100 != null) return `${pos} ${bucket.bb100 >= 0 ? '+' : ''}${bucket.bb100.toFixed(1)}`;
  return `${pos} (${bucket.hands}h)`;
}

// Every position hero has played this context/hand from, as inline badges -
// used by both HandDetailPanel's per-context block and HandClassLeaks' per-
// leak block, instead of yet another click-to-expand level.
export function PositionBadges({ ctxData }) {
  const positions = sortPositions(Object.keys(ctxData.byPosition || {}))
    .filter(pos => ctxData.byPosition[pos].hands > 0);
  if (positions.length === 0) return null;
  return (
    <div className="hcb-detail-positions">
      {positions.map(pos => (
        <Tag key={pos} color={positionBadgeColor(ctxData.byPosition[pos])}>
          {positionBadgeLabel(pos, ctxData.byPosition[pos])}
        </Tag>
      ))}
    </div>
  );
}
