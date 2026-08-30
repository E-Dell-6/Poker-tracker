import { describe, it, expect } from 'vitest';
import { classifyHoleCards } from '../utils/handClass.js';

describe('classifyHoleCards', () => {
  it('classifies a pocket pair', () => {
    expect(classifyHoleCards(['Ah', 'Ad'])).toEqual({ token: 'AA', category: 'pocketPairs', suited: false, isPair: true });
  });

  it('classifies a suited ace ahead of the broader suited-broadway bucket', () => {
    // AKs is both "has an ace, suited" and "both ranks are broadway" -
    // the dedicated Ax-suited bucket takes priority.
    expect(classifyHoleCards(['Ah', 'Kh'])).toEqual({ token: 'AKs', category: 'axSuited', suited: true, isPair: false });
  });

  it('classifies suited broadway (no ace)', () => {
    expect(classifyHoleCards(['Kh', 'Qh'])).toEqual({ token: 'KQs', category: 'suitedBroadway', suited: true, isPair: false });
  });

  it('classifies suited connectors', () => {
    expect(classifyHoleCards(['7h', '6h'])).toEqual({ token: '76s', category: 'suitedConnectors', suited: true, isPair: false });
  });

  it('classifies a suited one-gapper as a suited connector', () => {
    expect(classifyHoleCards(['8h', '6h'])).toEqual({ token: '86s', category: 'suitedConnectors', suited: true, isPair: false });
  });

  it('classifies offsuit broadway', () => {
    expect(classifyHoleCards(['Kd', 'Qc'])).toEqual({ token: 'KQo', category: 'offsuitBroadway', suited: false, isPair: false });
  });

  it('classifies offsuit gappers', () => {
    expect(classifyHoleCards(['7d', '6c'])).toEqual({ token: '76o', category: 'offsuitGappers', suited: false, isPair: false });
  });

  it('classifies a disconnected offsuit hand as other', () => {
    expect(classifyHoleCards(['7d', '2c'])).toEqual({ token: '72o', category: 'other', suited: false, isPair: false });
  });

  it('orders the token high card first regardless of input order', () => {
    expect(classifyHoleCards(['2h', 'Ah'])).toEqual({ token: 'A2s', category: 'axSuited', suited: true, isPair: false });
  });

  it('returns null for anything other than exactly 2 cards', () => {
    expect(classifyHoleCards([])).toBeNull();
    expect(classifyHoleCards(['Ah'])).toBeNull();
    expect(classifyHoleCards(['Ah', 'Kh', 'Qh', 'Jh'])).toBeNull();
    expect(classifyHoleCards(undefined)).toBeNull();
  });

  it('returns null for malformed card strings', () => {
    expect(classifyHoleCards(['Zh', 'Kh'])).toBeNull();
  });
});
