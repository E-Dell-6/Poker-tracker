import { describe, it, expect } from 'vitest';
import { confidenceModifier } from '../src/utils/confidence.js';

describe('confidenceModifier', () => {
  it('maps low confidence to the low-confidence modifier', () => {
    expect(confidenceModifier({ confidence: 'low' })).toBe('low-confidence');
  });

  it('maps medium confidence to the medium-confidence modifier', () => {
    expect(confidenceModifier({ confidence: 'medium' })).toBe('medium-confidence');
  });

  it('maps high confidence to no modifier (full visual weight is the default)', () => {
    expect(confidenceModifier({ confidence: 'high' })).toBe('');
  });

  it('returns no modifier for a missing/null rate rather than throwing', () => {
    expect(confidenceModifier(null)).toBe('');
    expect(confidenceModifier(undefined)).toBe('');
  });

  it('returns no modifier when a rate has no confidence field at all', () => {
    expect(confidenceModifier({ pct: 40, made: 4, opportunities: 10 })).toBe('');
  });
});
