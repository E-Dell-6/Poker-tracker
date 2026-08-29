import { describe, it, expect } from 'vitest';
import { getConfidence, getConfidenceForStat, CONFIDENCE_PROFILES } from '../utils/confidence.js';

describe('getConfidence', () => {
  it('defaults to the default profile', () => {
    expect(getConfidence(5)).toBe('low');
    expect(getConfidence(50)).toBe('medium');
    expect(getConfidence(150)).toBe('high');
  });

  it('respects profile boundaries (low is exclusive of the boundary)', () => {
    expect(getConfidence(29, CONFIDENCE_PROFILES.default)).toBe('low');
    expect(getConfidence(30, CONFIDENCE_PROFILES.default)).toBe('medium');
    expect(getConfidence(99, CONFIDENCE_PROFILES.default)).toBe('medium');
    expect(getConfidence(100, CONFIDENCE_PROFILES.default)).toBe('high');
  });

  it('the rare profile needs a larger sample for the same label', () => {
    expect(getConfidence(50, CONFIDENCE_PROFILES.rare)).toBe('low');
    expect(getConfidence(50, CONFIDENCE_PROFILES.default)).toBe('medium');
  });
});

describe('getConfidenceForStat', () => {
  it('uses the rare profile for fourBet/foldTo4Bet', () => {
    expect(getConfidenceForStat('fourBet', 50)).toBe('low');
    expect(getConfidenceForStat('foldTo4Bet', 50)).toBe('low');
  });

  it('uses the default profile for everything else', () => {
    expect(getConfidenceForStat('vpip', 50)).toBe('medium');
    expect(getConfidenceForStat('cbFlop', 50)).toBe('medium');
  });
});
