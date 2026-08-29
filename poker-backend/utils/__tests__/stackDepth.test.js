import { describe, it, expect } from 'vitest';
import { getStackDepthBucket, STACK_DEPTH_THRESHOLDS } from '../stackDepth.js';

describe('getStackDepthBucket', () => {
  it('buckets below the short threshold as short', () => {
    expect(getStackDepthBucket(0)).toBe('short');
    expect(getStackDepthBucket(STACK_DEPTH_THRESHOLDS.SHORT_MAX_BB - 1)).toBe('short');
  });

  it('buckets the short/mid boundary as mid (inclusive on the low end)', () => {
    expect(getStackDepthBucket(STACK_DEPTH_THRESHOLDS.SHORT_MAX_BB)).toBe('mid');
  });

  it('buckets the mid/deep boundary as mid (inclusive on the high end)', () => {
    expect(getStackDepthBucket(STACK_DEPTH_THRESHOLDS.MID_MAX_BB)).toBe('mid');
  });

  it('buckets above the mid threshold as deep', () => {
    expect(getStackDepthBucket(STACK_DEPTH_THRESHOLDS.MID_MAX_BB + 1)).toBe('deep');
    expect(getStackDepthBucket(500)).toBe('deep');
  });
});
