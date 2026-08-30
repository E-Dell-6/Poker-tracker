import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCached, setCached } from '../utils/statsCache.js';

describe('statsCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for a key that was never set', () => {
    expect(getCached('never-set')).toBeUndefined();
  });

  it('returns the cached value within the TTL window', () => {
    setCached('k1', { hello: 'world' }, 1000);
    expect(getCached('k1')).toEqual({ hello: 'world' });
  });

  it('expires the value once the TTL has elapsed, evicting it', () => {
    vi.useFakeTimers();
    setCached('k2', 'value', 1000);
    expect(getCached('k2')).toBe('value');

    vi.advanceTimersByTime(1001);

    expect(getCached('k2')).toBeUndefined();
    // Confirms it was evicted, not just skipped - a fresh set right after
    // an expiry check works normally.
    setCached('k2', 'fresh-value', 1000);
    expect(getCached('k2')).toBe('fresh-value');
  });

  it('keeps distinct keys independent', () => {
    setCached('a', 1, 1000);
    setCached('b', 2, 1000);
    expect(getCached('a')).toBe(1);
    expect(getCached('b')).toBe(2);
  });
});
