// A rate stat's `confidence` field ('low'|'medium'|'high') is computed
// once, server-side, in statsEngine.js's finalizeRate() - this just maps
// it to the modifier class each stat-cell component appends to its base
// class name (e.g. `stat-box ${confidenceModifier(rate)}`). 'high'
// confidence renders with no modifier (full visual weight, the default).
export function confidenceModifier(rate) {
  if (!rate || !rate.confidence || rate.confidence === 'high') return '';
  return rate.confidence === 'low' ? 'low-confidence' : 'medium-confidence';
}
