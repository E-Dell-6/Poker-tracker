import { describe, it, expect } from 'vitest';
import { simulateEquity, simulateEquityWithRng } from '../equityEngine.js';

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

describe('simulateEquity: river (0 unknown cards) - trivial, no runout needed', () => {
  it('gives the sole winner 100% equity', () => {
    const hero = ['Ah', 'Kh']; // ace-high flush
    const villain = ['2c', '3c']; // two pair on this board
    const board = ['Qh', 'Jh', '9h', '2d', '3d'];
    const [heroEq, villainEq] = simulateEquity([hero, villain], board);
    expect(heroEq).toBe(1);
    expect(villainEq).toBe(0);
  });

  it('splits equity evenly on a tie (the board plays)', () => {
    const hero = ['2c', '3c'];
    const villain = ['4d', '5d'];
    // Board alone is a full house (KKK QQ) that beats both hole-card pairs -
    // both hands just play the board, so it's an exact chop.
    const board = ['Kh', 'Kd', 'Kc', 'Qh', 'Qd'];
    const [heroEq, villainEq] = simulateEquity([hero, villain], board);
    expect(heroEq).toBe(0.5);
    expect(villainEq).toBe(0.5);
  });
});

describe('simulateEquity: turn (1 unknown card) - exact enumeration', () => {
  it('matches an exact equity split, cross-checked river-by-river', () => {
    // Hero: trip nines (9h9d + board's 9c). Villain: Ah Kh with a heart
    // and a wheel-straight draw live off the board's 2h 3h 4d. This spot
    // is deliberately tangled - some rivers give villain a flush or a
    // wheel straight (beats trips), but a river 4h pairs the board's 4d
    // and gives HERO a full house instead (beats villain's flush) - the
    // kind of interaction that's easy to get wrong by hand and exactly
    // what this test is for. Expected split (34 hero / 10 villain, out of
    // 44 possible river cards) was cross-checked by enumerating all 44
    // rivers directly against evaluateHand() independently of
    // simulateEquity, so this test verifies simulateEquity's own
    // enumeration/tallying logic, not evaluateHand's correctness (already
    // covered exhaustively in handEvaluator.test.js).
    const hero = ['9h', '9d'];
    const villain = ['Ah', 'Kh'];
    const board = ['9c', '2h', '3h', '4d'];
    const [heroEq, villainEq] = simulateEquity([hero, villain], board);

    expect(heroEq).toBeCloseTo(34 / 44, 10);
    expect(villainEq).toBeCloseTo(10 / 44, 10);
    expect(heroEq + villainEq).toBeCloseTo(1, 10);
  });

  it('is deterministic (exact enumeration, not sampled)', () => {
    const hero = ['9h', '9d'];
    const villain = ['Ah', 'Kh'];
    const board = ['9c', '2h', '3h', '4d'];
    const runA = simulateEquity([hero, villain], board);
    const runB = simulateEquity([hero, villain], board);
    expect(runA).toEqual(runB);
  });
});

describe('simulateEquity: flop (2 unknown cards) - exact enumeration', () => {
  it('gives a big statistical favorite most of the equity, sums to 1', () => {
    // Hero flopped a set; villain has an overpair with no flush draw and
    // only 2 outs (the other two kings) to catch up.
    const hero = ['7h', '7d'];
    const villain = ['Kc', 'Kd'];
    const board = ['7c', '2h', '3d'];
    const [heroEq, villainEq] = simulateEquity([hero, villain], board);

    expect(heroEq + villainEq).toBeCloseTo(1, 10);
    expect(heroEq).toBeGreaterThan(0.85);
    expect(villainEq).toBeLessThan(0.15);
  });

  it('is deterministic across repeated calls', () => {
    const hero = ['7h', '7d'];
    const villain = ['Kc', 'Kd'];
    const board = ['7c', '2h', '3d'];
    const runA = simulateEquity([hero, villain], board);
    const runB = simulateEquity([hero, villain], board);
    expect(runA).toEqual(runB);
  });
});

describe('simulateEquity: preflop (5 unknown cards) - Monte Carlo', () => {
  it('AA vs KK converges to the well-known ~82/18 split', () => {
    const rng = mulberry32(42);
    const [aa, kk] = simulateEquityWithRng([['Ah', 'Ad'], ['Kh', 'Kd']], [], 20000, rng);
    expect(aa + kk).toBeCloseTo(1, 6);
    expect(aa).toBeGreaterThan(0.78);
    expect(aa).toBeLessThan(0.86);
  });

  it('is reproducible with the same seeded rng, and default (Math.random) trials still sum to 1', () => {
    const rngA = mulberry32(7);
    const rngB = mulberry32(7);
    const runA = simulateEquityWithRng([['Ah', 'Ad'], ['Kh', 'Kd']], [], 5000, rngA);
    const runB = simulateEquityWithRng([['Ah', 'Ad'], ['Kh', 'Kd']], [], 5000, rngB);
    expect(runA).toEqual(runB);

    const publicApiRun = simulateEquity([['Ah', 'Ad'], ['Kh', 'Kd']], [], 1000);
    expect(sum(publicApiRun)).toBeCloseTo(1, 10);
  });
});

describe('simulateEquity: 3+ way pots', () => {
  it('handles more than 2 hands and still sums to 1', () => {
    const hands = [['Ah', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd']];
    const rng = mulberry32(1);
    const equities = simulateEquityWithRng(hands, [], 3000, rng);
    expect(equities).toHaveLength(3);
    expect(sum(equities)).toBeCloseTo(1, 10);
    // AA should still be the favorite in a 3-way with KK and QQ.
    expect(equities[0]).toBeGreaterThan(equities[1]);
    expect(equities[1]).toBeGreaterThan(equities[2]);
  });
});

describe('simulateEquity: input validation', () => {
  it('rejects fewer than 2 hands', () => {
    expect(() => simulateEquity([['Ah', 'Ad']], [])).toThrow();
  });

  it('rejects a board with more than 5 cards', () => {
    expect(() => simulateEquity([['Ah', 'Ad'], ['Kh', 'Kd']], ['2c', '3c', '4c', '5c', '6c', '7c'])).toThrow();
  });
});
