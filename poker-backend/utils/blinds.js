// Shared bb-size parsing, used anywhere a dollar/chip amount needs to be
// expressed in big-blind units (bb100, effective stack depth, etc).

// Sessions logged in these currencies store dollar amounts (profitLoss,
// stack, etc.) in integer CENTS (see ACRPokerParser.js). `stakes` is always
// the raw display string (e.g. "$1/$2"), i.e. major units - so the parsed
// bb figure has to be scaled up to match those fields' units before the two
// are ever divided together, or the result comes out ~100x too large/small.
export const CENTS_CURRENCIES = new Set(['USD', 'CAD']);

export function parseBigBlind(stakes, currency) {
  if (!stakes) return null;
  const parts = String(stakes).split('/').map(s => parseFloat(s.replace(/[^0-9.]/g, '')));
  const bb = parts[parts.length - 1];
  if (!Number.isFinite(bb) || bb <= 0) return null;
  return CENTS_CURRENCIES.has(currency) ? bb * 100 : bb;
}
