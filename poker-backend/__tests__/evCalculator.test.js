import { describe, it, expect } from 'vitest';
import { computeAllInEV } from '../utils/evCalculator.js';
import { simulateEquity } from '../utils/equityEngine.js';

function baseHand(overrides) {
  return {
    isAllIn: true,
    players: [
      { name: 'Hero', stack: 500, isHero: true, isSittingOut: false, holeCards: ['7h', '7d'] },
      { name: 'Villain', stack: 500, isHero: false, isSittingOut: false, showedHand: ['Kc', 'Kd'] }
    ],
    // board.turn/river are CUMULATIVE (whole board-to-date), matching what
    // both real parsers actually produce - see evCalculator.js's comment.
    // Irrelevant here either way since the all-in trigger is on the flop.
    board: { flop: ['7c', '2h', '3d'], turn: ['7c', '2h', '3d', '9s'], river: ['7c', '2h', '3d', '9s', '4c'] },
    actions: [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5, potSizeAfter: 5 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10, potSizeAfter: 15 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 30, potSizeAfter: 40 },
      { street: 'PREFLOP', actionType: 'CALL', player: 'Villain', amount: 20, potSizeAfter: 60 },
      { street: 'FLOP', actionType: 'BET', player: 'Hero', amount: 470, potSizeAfter: 530 },   // hero's remaining stack (470) hits 0 -> trigger
      { street: 'FLOP', actionType: 'CALL', player: 'Villain', amount: 470, potSizeAfter: 1000 }
    ],
    ...overrides
  };
}

describe('computeAllInEV', () => {
  it('returns null immediately when the hand is not flagged all-in', () => {
    expect(computeAllInEV(baseHand({ isAllIn: false }))).toBeNull();
    expect(computeAllInEV(baseHand({ isAllIn: null }))).toBeNull();
  });

  it('computes EV using the board AS IT STOOD at the all-in (flop), hero\'s TOTAL invested, and the final pot', () => {
    const hand = baseHand();
    const result = computeAllInEV(hand);

    // Cross-checked against the already-validated simulateEquity directly
    // (item 4c's test suite), using the flop-only board - NOT the full
    // 5-card board stored on the hand (turn 9s / river 4c happened, but
    // are irrelevant to what hero's equity was going into the runout).
    const [heroEquity] = simulateEquity([['7h', '7d'], ['Kc', 'Kd']], ['7c', '2h', '3d']);
    const potAtAllIn = 1000;
    const heroInvested = 500; // 30 preflop (5 SB + 25 raise) + 470 flop shove - the WHOLE hand, not just the flop action
    const expected = heroEquity * potAtAllIn - heroInvested;

    expect(result).toBeCloseTo(expected, 10);
  });

  it('uses the board as it stood at a TURN all-in (4 cards), not the incremental turn card and not the river', () => {
    // Regression test for a real bug caught while building this: both
    // parsers store board.turn/river CUMULATIVELY (the whole board-to-
    // date, 4 and 5 cards respectively - see extractACRBoardCards/
    // extractBoardCards and HandReplayer.jsx, which reads them the same
    // way) - an earlier version of evCalculator.js assumed board.turn was
    // just the single new turn card and concatenated it onto the flop,
    // which double-counted the flop cards for any turn-triggered all-in.
    const hand = baseHand({
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5, potSizeAfter: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10, potSizeAfter: 15 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 30, potSizeAfter: 40 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Villain', amount: 20, potSizeAfter: 60 },
        { street: 'FLOP', actionType: 'CHECK', player: 'Villain', amount: 0, potSizeAfter: 60 },
        { street: 'FLOP', actionType: 'CHECK', player: 'Hero', amount: 0, potSizeAfter: 60 },
        { street: 'TURN', actionType: 'BET', player: 'Hero', amount: 470, potSizeAfter: 530 }, // hero's remaining stack (470) hits 0 -> trigger, on the TURN
        { street: 'TURN', actionType: 'CALL', player: 'Villain', amount: 470, potSizeAfter: 1000 }
      ]
    });
    const result = computeAllInEV(hand);

    const [heroEquity] = simulateEquity([['7h', '7d'], ['Kc', 'Kd']], ['7c', '2h', '3d', '9s']);
    const expected = heroEquity * 1000 - 500;

    expect(result).toBeCloseTo(expected, 10);
    // The old (buggy) flop+turn concatenation would have built a 7-card
    // board and thrown inside simulateEquity (board.length > 5) - this
    // passing at all, with the right value, confirms the fix.
  });

  it('returns null when hero folds before the all-in resolves (not a participant)', () => {
    const hand = baseHand({
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5, potSizeAfter: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10, potSizeAfter: 15 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 5, potSizeAfter: 20 },
        { street: 'FLOP', actionType: 'BET', player: 'Villain', amount: 490, potSizeAfter: 510 },
        { street: 'FLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 510 }
      ]
    });
    expect(computeAllInEV(hand)).toBeNull();
  });

  it('returns null when a side pot would form (a bet/raise after the trigger)', () => {
    const hand = baseHand({
      players: [
        { name: 'Hero', stack: 200, isHero: true, isSittingOut: false, holeCards: ['7h', '7d'] },
        { name: 'Villain', stack: 500, isHero: false, isSittingOut: false, showedHand: ['Kc', 'Kd'] }
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5, potSizeAfter: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10, potSizeAfter: 15 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 200, potSizeAfter: 210 }, // hero all-in for her whole 200 stack
        { street: 'PREFLOP', actionType: 'CALL', player: 'Villain', amount: 190, potSizeAfter: 400 },
        // Side pot: nothing left for hero to contest, but this line
        // shouldn't occur once everyone's matched - included here as the
        // "a bet/raise happened after the trigger" case regardless of realism.
        { street: 'FLOP', actionType: 'BET', player: 'Villain', amount: 100, potSizeAfter: 500 }
      ]
    });
    expect(computeAllInEV(hand)).toBeNull();
  });

  it('returns null when the opponent never showed their hand', () => {
    const hand = baseHand({
      players: [
        { name: 'Hero', stack: 500, isHero: true, isSittingOut: false, holeCards: ['7h', '7d'] },
        { name: 'Villain', stack: 500, isHero: false, isSittingOut: false } // no showedHand
      ]
    });
    expect(computeAllInEV(hand)).toBeNull();
  });

  it('returns null when only one player is still live at the end (uncontested)', () => {
    const hand = baseHand({
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5, potSizeAfter: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10, potSizeAfter: 15 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 500, potSizeAfter: 505 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'Villain', amount: 0, potSizeAfter: 505 }
      ]
    });
    expect(computeAllInEV(hand)).toBeNull();
  });

  it('returns null when hero has no known 2-card hand (e.g. PLO, out of scope)', () => {
    const hand = baseHand({
      players: [
        { name: 'Hero', stack: 500, isHero: true, isSittingOut: false, holeCards: ['7h', '7d', '2c', '2d'] },
        { name: 'Villain', stack: 500, isHero: false, isSittingOut: false, showedHand: ['Kc', 'Kd'] }
      ]
    });
    expect(computeAllInEV(hand)).toBeNull();
  });
});
