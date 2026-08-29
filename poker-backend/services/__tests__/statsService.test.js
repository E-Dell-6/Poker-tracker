import { describe, it, expect } from 'vitest';
import { buildEvGraphRows } from '../statsService.js';

function heroHand({ handIndex, profitLoss, allInEV = null }) {
  return {
    handIndex,
    allInEV,
    players: [{ name: 'Hero', isHero: true, profitLoss }]
  };
}

describe('buildEvGraphRows', () => {
  it('orders hands chronologically by session date, then by handIndex within a session', () => {
    const sessions = [
      { date: '2026-01-02', currency: 'CHIPS', hands: [heroHand({ handIndex: 2, profitLoss: 20 }), heroHand({ handIndex: 1, profitLoss: 10 })] },
      { date: '2026-01-01', currency: 'CHIPS', hands: [heroHand({ handIndex: 1, profitLoss: -5 })] }
    ];
    const rows = buildEvGraphRows(sessions);
    // Jan 1 session's hand comes first despite being listed second in the input.
    expect(rows.map(r => r.actualResult)).toEqual([-5, 10, 20]);
    // Output handIndex is a fresh 0-based sequence, not the stored hand.handIndex.
    expect(rows.map(r => r.handIndex)).toEqual([0, 1, 2]);
  });

  it('computes running cumulative sums for both actual and EV', () => {
    const sessions = [
      { date: '2026-01-01', currency: 'CHIPS', hands: [
        heroHand({ handIndex: 1, profitLoss: 10 }),
        heroHand({ handIndex: 2, profitLoss: -30 }),
        heroHand({ handIndex: 3, profitLoss: 5 })
      ] }
    ];
    const rows = buildEvGraphRows(sessions);
    expect(rows.map(r => r.cumulativeActual)).toEqual([10, -20, -15]);
  });

  it('falls back to actualResult for evResult when allInEV is null (non-all-in hands)', () => {
    const sessions = [{ date: '2026-01-01', currency: 'CHIPS', hands: [heroHand({ handIndex: 1, profitLoss: 40 })] }];
    const rows = buildEvGraphRows(sessions);
    expect(rows[0].evResult).toBe(40);
    expect(rows[0].cumulativeEV).toBe(40);
  });

  it('uses allInEV instead of actualResult when present, and the two lines can diverge', () => {
    const sessions = [{
      date: '2026-01-01', currency: 'CHIPS',
      hands: [{ handIndex: 1, allInEV: 25, players: [{ name: 'Hero', isHero: true, profitLoss: -50 }] }]
    }];
    const rows = buildEvGraphRows(sessions);
    expect(rows[0].actualResult).toBe(-50); // hero actually lost the pot (a bad beat)
    expect(rows[0].evResult).toBe(25);      // but was a big equity favorite going in
  });

  it('normalizes cents currencies (USD/CAD) to major units, independently per session', () => {
    const sessions = [
      { date: '2026-01-01', currency: 'USD', hands: [heroHand({ handIndex: 1, profitLoss: 2500 })] }, // $25.00
      { date: '2026-01-02', currency: 'CHIPS', hands: [heroHand({ handIndex: 1, profitLoss: 2500 })] } // 2500 chips, no scaling
    ];
    const rows = buildEvGraphRows(sessions);
    expect(rows[0].actualResult).toBe(25);
    expect(rows[1].actualResult).toBe(2500);
  });

  it('skips hands with no profitLoss data (e.g. parsed before that field existed) without breaking the sequence', () => {
    const sessions = [{
      date: '2026-01-01', currency: 'CHIPS',
      hands: [
        heroHand({ handIndex: 1, profitLoss: 10 }),
        { handIndex: 2, players: [{ name: 'Hero', isHero: true }] }, // profitLoss undefined
        heroHand({ handIndex: 3, profitLoss: 5 })
      ]
    }];
    const rows = buildEvGraphRows(sessions);
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.actualResult)).toEqual([10, 5]);
    expect(rows.map(r => r.handIndex)).toEqual([0, 1]); // still a contiguous output sequence
  });

  it('returns an empty array for no sessions', () => {
    expect(buildEvGraphRows([])).toEqual([]);
  });
});
