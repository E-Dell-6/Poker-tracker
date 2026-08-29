// Sample-size confidence tagging for rate stats. A 2/5 stat and a 200/500
// stat both render as "40%" without this - the caller needs to know which
// one to trust.
//
// Thresholds are named, not magic numbers, and vary per profile: some
// spots are inherently rarer (a 4-bet, or a fold-to-3-bet specifically
// inside a 3-bet pot) and need a larger sample before the same confidence
// label is warranted.
export const CONFIDENCE_PROFILES = {
  default: { low: 30, medium: 100 },  // most rate stats: vpip, pfr, cbFlop, ...
  rare: { low: 100, medium: 300 }     // low-sample-by-nature spots: fourBet, foldTo4Bet, position-matrix cells
};

// Stat keys that use the stricter 'rare' profile - everything else on a
// rate-stat-bearing object defaults to 'default'. Position-matrix cells
// (vsOpen/vs3Bet - see statsEngine.js's finalizeVsStat) always use 'rare'
// regardless of key, since any single attacker/responder position pairing
// is inherently a small slice of the data - handled separately by callers,
// not through this map.
export const RARE_STAT_KEYS = new Set(['fourBet', 'foldTo4Bet', 'cbTurn', 'cbRiver', 'donk', 'probe']);

export function getConfidence(opportunities, profile = CONFIDENCE_PROFILES.default) {
  if (opportunities < profile.low) return 'low';
  if (opportunities < profile.medium) return 'medium';
  return 'high';
}

// Convenience for callers that only have the stat key, not the profile.
export function getConfidenceForStat(statKey, opportunities) {
  const profile = RARE_STAT_KEYS.has(statKey) ? CONFIDENCE_PROFILES.rare : CONFIDENCE_PROFILES.default;
  return getConfidence(opportunities, profile);
}
