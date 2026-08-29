import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  formatSignedAmount,
  formatSignedMajorUnits,
  isCentsCurrency,
  toMajorUnits
} from '../src/utils/formatMoney.js';

describe('formatAmount', () => {
  it('divides cents currencies by 100 and prefixes the symbol', () => {
    expect(formatAmount(2550, 'USD')).toBe('$25.50');
    expect(formatAmount(100, 'CAD')).toBe('$1.00');
  });

  it('passes CHIPS through unscaled with no symbol', () => {
    expect(formatAmount(2550, 'CHIPS')).toBe('2550');
  });

  it('treats an unknown/missing currency as CHIPS (no scaling, no symbol)', () => {
    expect(formatAmount(500, undefined)).toBe('500');
    expect(formatAmount(500, 'BITCOIN')).toBe('500');
  });

  it('coerces non-numeric input to 0 rather than throwing', () => {
    expect(formatAmount(null, 'USD')).toBe('$0.00');
    expect(formatAmount(undefined, 'USD')).toBe('$0.00');
    expect(formatAmount('not a number', 'USD')).toBe('$0.00');
  });
});

describe('formatSignedAmount', () => {
  it('prefixes a positive value with + and puts the sign before the symbol', () => {
    expect(formatSignedAmount(2500, 'USD')).toBe('+$25.00');
  });

  it('prefixes a negative value with - and puts the sign before the symbol (not $-25.00)', () => {
    expect(formatSignedAmount(-2500, 'USD')).toBe('-$25.00');
  });

  it('shows no sign for exactly zero', () => {
    expect(formatSignedAmount(0, 'USD')).toBe('$0.00');
  });

  it('works for CHIPS (no symbol, still signed)', () => {
    expect(formatSignedAmount(150, 'CHIPS')).toBe('+150');
    expect(formatSignedAmount(-150, 'CHIPS')).toBe('-150');
  });
});

describe('formatSignedMajorUnits', () => {
  it('does NOT divide by 100 - the value is already in major units', () => {
    // Regression case: this is exactly the bug found and fixed in
    // PlayerStats.jsx - passing an already-major-units value (like
    // statsEngine.js's totalProfitLoss) through the cents-aware
    // formatSignedAmount silently shrunk it ~100x ($50.00 -> $0.50).
    expect(formatSignedMajorUnits(50, 'USD')).toBe('+$50.00');
    expect(formatSignedMajorUnits(-50, 'USD')).toBe('-$50.00');
  });

  it('still adds the correct symbol per currency', () => {
    expect(formatSignedMajorUnits(10, 'CAD')).toBe('+$10.00');
    expect(formatSignedMajorUnits(10, 'CHIPS')).toBe('+10.00');
  });

  it('shows no sign for exactly zero', () => {
    expect(formatSignedMajorUnits(0, 'USD')).toBe('$0.00');
  });
});

describe('isCentsCurrency', () => {
  it('is true for USD/CAD, false for CHIPS and unknown currencies', () => {
    expect(isCentsCurrency('USD')).toBe(true);
    expect(isCentsCurrency('CAD')).toBe(true);
    expect(isCentsCurrency('CHIPS')).toBe(false);
    expect(isCentsCurrency(undefined)).toBe(false);
  });
});

describe('toMajorUnits', () => {
  it('divides cents currencies by 100', () => {
    expect(toMajorUnits(2550, 'USD')).toBe(25.5);
  });

  it('leaves CHIPS/plain-unit amounts unscaled', () => {
    expect(toMajorUnits(2550, 'CHIPS')).toBe(2550);
  });

  it('returns a number, not a string (unlike formatAmount)', () => {
    expect(typeof toMajorUnits(100, 'USD')).toBe('number');
  });
});
