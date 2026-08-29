import { describe, it, expect } from 'vitest';
import { detectAllIn } from '../allInDetector.js';

function baseHand(overrides) {
  return {
    players: [
      { name: 'Hero', stack: 1000, isSittingOut: false },
      { name: 'Villain', stack: 1000, isSittingOut: false }
    ],
    actions: [],
    ...overrides
  };
}

describe('detectAllIn', () => {
  it('detects a clean preflop shove', () => {
    const hand = baseHand({
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 1000 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Villain', amount: 990 }
      ]
    });
    expect(detectAllIn(hand)).toBe(true);
    expect(hand.isAllIn).toBe(true);
  });

  it('returns false when both players have chips behind', () => {
    const hand = baseHand({
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 30 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Villain', amount: 20 },
        { street: 'FLOP', actionType: 'CHECK', player: 'Villain', amount: 0 },
        { street: 'FLOP', actionType: 'CHECK', player: 'Hero', amount: 0 }
      ]
    });
    expect(detectAllIn(hand)).toBe(false);
  });

  it('detects an all-in that is not the hand\'s final action', () => {
    const hand = baseHand({
      players: [
        { name: 'Hero', stack: 300, isSittingOut: false },
        { name: 'Villain', stack: 1000, isSittingOut: false }
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 30 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Villain', amount: 20 },
        { street: 'FLOP', actionType: 'BET', player: 'Villain', amount: 270 },
        { street: 'FLOP', actionType: 'CALL', player: 'Hero', amount: 270 }, // Hero's 300 stack now fully committed
        { street: 'TURN', actionType: 'CHECK', player: 'Villain', amount: 0 } // action continues without Hero
      ]
    });
    expect(detectAllIn(hand)).toBe(true);
  });

  it('returns null (not false) when a player\'s starting stack is unknown', () => {
    const hand = baseHand({
      players: [
        { name: 'Hero', stack: null, isSittingOut: false },
        { name: 'Villain', stack: 1000, isSittingOut: false }
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'CHECK', player: 'Villain', amount: 0 }
      ]
    });
    expect(detectAllIn(hand)).toBeNull();
  });

  it('a positive detection wins even if another player\'s stack is unknown', () => {
    const hand = baseHand({
      players: [
        { name: 'Hero', stack: null, isSittingOut: false },
        { name: 'Villain', stack: 100, isSittingOut: false }
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 100 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 95 }
      ]
    });
    expect(detectAllIn(hand)).toBe(true);
  });

  it('a sitting-out player\'s missing stack does not force null', () => {
    const hand = baseHand({
      players: [
        { name: 'Hero', stack: 1000, isSittingOut: false },
        { name: 'Villain', stack: 1000, isSittingOut: false },
        { name: 'Bystander', stack: null, isSittingOut: true }
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 10 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 5 },
        { street: 'PREFLOP', actionType: 'CHECK', player: 'Villain', amount: 0 }
      ]
    });
    expect(detectAllIn(hand)).toBe(false);
  });
});
