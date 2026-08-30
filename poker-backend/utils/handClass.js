// Classifies hero's hole cards into a 169-hand-class token (e.g. "AKs",
// "76o", "AA") plus a broader display category, for the Study page's "Win
// rate by hand class" breakdown. A single-purpose classifier consumed by
// statsEngine.js, same role flopTexture.js/stackDepth.js already play there
// - no existing code did this before, this is the whole implementation.

import { parseCard } from './cardParser.js';

const RANK_LABELS = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const BROADWAY_MIN_RANK = 10; // T, J, Q, K, A

export const HAND_CLASS_CATEGORIES = [
  { key: 'pocketPairs', label: 'Pocket pairs' },
  { key: 'axSuited', label: 'Ax suited' },
  { key: 'suitedBroadway', label: 'Suited broadway' },
  { key: 'suitedConnectors', label: 'Suited connectors' },
  { key: 'offsuitBroadway', label: 'Offsuit broadway' },
  { key: 'offsuitGappers', label: 'Offsuit gappers' },
  { key: 'other', label: 'Other' }
];

// `holeCards` is the raw 2-card array from PlayerSetupSchema. Returns null
// for anything that isn't exactly 2 well-formed cards (PLO hands, unrevealed
// opponent cards) - hand-class-by-position only makes sense for a 2-card
// NLH hand.
export function classifyHoleCards(holeCards) {
  if (!Array.isArray(holeCards) || holeCards.length !== 2) return null;

  let a, b;
  try {
    a = parseCard(holeCards[0]);
    b = parseCard(holeCards[1]);
  } catch {
    return null;
  }

  const [hi, lo] = a.rank >= b.rank ? [a, b] : [b, a];
  const suited = a.suit === b.suit;
  const isPair = hi.rank === lo.rank;

  const token = isPair
    ? `${RANK_LABELS[hi.rank]}${RANK_LABELS[lo.rank]}`
    : `${RANK_LABELS[hi.rank]}${RANK_LABELS[lo.rank]}${suited ? 's' : 'o'}`;

  const gap = hi.rank - lo.rank - 1; // 0 = connectors (no gap), 1 = one-gapper
  const bothBroadway = hi.rank >= BROADWAY_MIN_RANK && lo.rank >= BROADWAY_MIN_RANK;
  const hasAce = hi.rank === 14;

  // Priority order resolves overlaps a flat partition can't avoid (AKs is
  // both "has an ace" and "both broadway"): pairs first, then suited-ace
  // hands get their own bucket ahead of the broader broadway one (so AKs/
  // AQs/... show under "Ax suited", not "suited broadway"), then broadway,
  // then connector-ish hands (gap 0 or 1). Offsuit mirrors suited minus the
  // dedicated ace bucket - there's no "Ax offsuit" category, AKo falls
  // under offsuit broadway same as KQo.
  let category;
  if (isPair) category = 'pocketPairs';
  else if (suited && hasAce) category = 'axSuited';
  else if (suited && bothBroadway) category = 'suitedBroadway';
  else if (suited && gap <= 1) category = 'suitedConnectors';
  else if (!suited && bothBroadway) category = 'offsuitBroadway';
  else if (!suited && gap <= 1) category = 'offsuitGappers';
  else category = 'other';

  return { token, category, suited, isPair };
}
