// Shared constants for BoardTexture.jsx - kept separate from
// handClassShared.jsx since these are unrelated to HandClassBreakdown/
// HandClassLeaks (that file's documented consumers).

// Order/labels for the independent texture facets a flop can carry - see
// statsEngine.js's TEXTURE_TAG_KEYS/flopTexture.js's classifyFlopTexture.
// Suit pattern (monotone/twoTone/rainbow) is inherently mutually exclusive
// per board; paired/trips/connected/acehigh are independent flags layered
// on top - all seven are listed together since a board can match several
// at once and the UI treats them uniformly either way.
export const TEXTURE_TAG_ORDER = [
  ['monotone', 'Monotone'],
  ['twoTone', 'Two-Tone'],
  ['rainbow', 'Rainbow'],
  ['paired', 'Paired'],
  ['trips', 'Trips'],
  ['connected', 'Connected'],
  ['acehigh', 'Ace-High']
];
export const TEXTURE_TAG_LABEL = Object.fromEntries(TEXTURE_TAG_ORDER);

// Display order for hero's first-flop-action mix (bet/check/raise/call/fold).
export const ACTION_MIX_ORDER = [
  ['bet', 'Bet'],
  ['check', 'Check'],
  ['raise', 'Raise'],
  ['call', 'Call'],
  ['fold', 'Fold']
];

// Compact "Bet 62% · Check 38%" style summary of an actionMix bucket -
// only the action types that actually occurred, in ACTION_MIX_ORDER.
export function actionMixSummary(actionMix) {
  if (!actionMix || actionMix.total === 0) return null;
  return ACTION_MIX_ORDER
    .map(([key, label]) => [label, actionMix[key]])
    .filter(([, stat]) => stat.count > 0)
    .map(([label, stat]) => `${label} ${stat.pct}%`)
    .join(' · ');
}

// "48% pot" style sizing summary, null when hero never bet/raised in this bucket.
export function sizingSummary(sizing) {
  if (!sizing || sizing.avgPotPct == null) return null;
  return `${sizing.avgPotPct}% pot`;
}
