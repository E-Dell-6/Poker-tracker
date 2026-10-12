// Sample stats.byHandClass / byHandClassCategory for the /dev/ui preview,
// in the shapes statsEngine.js's finalizeHandClassMap() /
// finalizeHandClassCategoryMap() produce. Deterministic, so screenshots
// are comparable run to run. Dev-only - imported by UiGallery.jsx.

// [token, category, [[context, hands, bb100, {position: [hands, bb100]}], ...]]
const HANDS = [
  ['AA', 'pocketPairs', [['open', 60, 42, { BTN: [22, 51], CO: [20, 38], UTG: [18, 35] }], ['threeBet', 34, 66, { BB: [18, 70], SB: [16, 61] }]]],
  ['QQ', 'pocketPairs', [['open', 48, 18, { BTN: [20, 24], HJ: [28, 14] }], ['callVs3Bet', 31, -22, { CO: [17, -30], BTN: [14, -12] }]]],
  ['77', 'pocketPairs', [['open', 40, 6, { CO: [22, 9], BTN: [18, 3] }], ['coldCall', 33, -14, { BB: [33, -14] }]]],
  ['AKs', 'axSuited', [['open', 52, 31, { BTN: [30, 35], UTG: [22, 25] }], ['fourBet', 12, 48, { CO: [12, 48] }]]],
  ['A5s', 'axSuited', [['open', 44, -8, { CO: [24, -4], HJ: [20, -13] }], ['threeBet', 18, 12, { BTN: [18, 12] }]]],
  ['A9s', 'axSuited', [['coldCall', 38, -31, { BTN: [21, -25], CO: [17, -38] }]]],
  ['KQs', 'suitedBroadway', [['open', 41, 11, { BTN: [25, 15], CO: [16, 5] }], ['coldCall', 30, -9, { BB: [30, -9] }]]],
  ['QJs', 'suitedBroadway', [['open', 36, 4, { CO: [36, 4] }]]],
  ['98s', 'suitedConnectors', [['open', 32, 7, { BTN: [32, 7] }], ['coldCall', 31, -19, { BB: [19, -24], BTN: [12, -11] }]]],
  ['76s', 'suitedConnectors', [['open', 28, -3, { BTN: [28, -3] }]]],
  ['AKo', 'offsuitBroadway', [['open', 70, 15, { BTN: [30, 22], UTG: [22, 9], CO: [18, 11] }], ['callVs3Bet', 34, -27, { CO: [20, -33], HJ: [14, -18] }]]],
  ['AQo', 'offsuitBroadway', [['open', 55, -6, { UTG: [25, -15], BTN: [30, 1] }], ['coldCall', 36, -41, { CO: [20, -45], HJ: [16, -36] }]]],
  ['KJo', 'offsuitBroadway', [['open', 39, -12, { HJ: [19, -18], CO: [20, -6] }]]],
  ['J9o', 'offsuitGappers', [['limp', 31, -35, { SB: [31, -35] }]]],
  ['72o', 'other', [['checkedOption', 64, -18, { BB: [64, -18] }], ['foldPreflop', 140, 0, { UTG: [70, 0], CO: [70, 0] }]]],
];

// Money in dollars at a notional $0.50 big blind, so net $ tracks bb/100.
function bucket(hands, bb100) {
  return {
    hands,
    bb100,
    handsWithProfitData: hands,
    totalProfitLoss: Math.round(((bb100 * hands) / 100) * 0.5 * 100) / 100,
    currency: 'USD',
  };
}

function combine(buckets) {
  const hands = buckets.reduce((sum, b) => sum + b.hands, 0);
  const bb100 = buckets.reduce((sum, b) => sum + b.bb100 * b.hands, 0) / hands;
  return bucket(hands, Math.round(bb100 * 10) / 10);
}

export const HAND_CLASS_FIXTURE = {};
export const HAND_CLASS_CATEGORY_FIXTURE = {};

for (const [token, category, contexts] of HANDS) {
  const ctxBuckets = {};
  for (const [ctx, hands, bb100, positions] of contexts) {
    ctxBuckets[ctx] = {
      ...bucket(hands, bb100),
      byPosition: Object.fromEntries(Object.entries(positions).map(([pos, [h, r]]) => [pos, bucket(h, r)])),
    };
  }
  HAND_CLASS_FIXTURE[token] = { ...combine(Object.values(ctxBuckets)), category, contexts: ctxBuckets };
}

for (const category of new Set(HANDS.map(([, cat]) => cat))) {
  HAND_CLASS_CATEGORY_FIXTURE[category] = combine(
    Object.values(HAND_CLASS_FIXTURE).filter(h => h.category === category)
  );
}
