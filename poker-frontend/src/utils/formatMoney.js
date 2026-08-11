//   1. isCents  - is this currency logged as integer cents
//   2. symbol   - what prefix (if any) to render.

// Keeping them separate (instead of hardcoding to 'USD') means adding a
// new real-money site (e.g. GGPoker/CAD) is a one-line addition below,
// not a new if/else branch.
const CURRENCY_META = {
  USD:   { isCents: true,  symbol: '$' },
  CAD:   { isCents: true,  symbol: '$' },
  CHIPS: { isCents: false, symbol: '' },
};

function getCurrencyMeta(currency) {
  return CURRENCY_META[currency] ?? CURRENCY_META.CHIPS;
}

export function formatAmount(amount, currency) {
  const value = Number(amount) || 0;
  const { isCents, symbol } = getCurrencyMeta(currency);
  if (isCents) {
    return `${symbol}${(value / 100).toFixed(2)}`;
  }
  return `${value}`;
}

// For profit/loss style displays where the value can be negative and the
// sign needs to sit in front of the currency symbol (e.g. "-$5.00", not
// "$-5.00"). Positive values get an explicit "+".
export function formatSignedAmount(amount, currency) {
  const value = Number(amount) || 0;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatAmount(Math.abs(value), currency)}`;
}

// Convenience helper for components that just need a boolean.
export function isCentsCurrency(currency) {
  return getCurrencyMeta(currency).isCents;
}