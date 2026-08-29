import { describe, it, expect } from 'vitest';
import { computeStatsForHands, matchHero } from '../utils/statsEngine.js';

// statsEngine.js's core accumulator predates this session's test suite and
// has no dedicated coverage of its own (only exercised indirectly through
// newer feature tests). This isn't an attempt at exhaustive coverage of the
// whole engine - just the showdownBreakdown/per-position-bb100 fields added
// for the Study page redesign, which had none.

function hand({ handIndex, heroWins, heroFolds, showdown, profitLoss }) {
  const players = [
    { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200 },
    { seat: 2, name: 'Villain', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200 },
  ];
  const actions = [
    { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 100, potSizeAfter: 100 },
    { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 200, potSizeAfter: 300 },
  ];
  if (heroFolds) {
    actions.push({ street: 'PREFLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 300 });
  } else {
    actions.push({ street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 100, potSizeAfter: 400 });
    actions.push({ street: 'PREFLOP', actionType: 'CHECK', player: 'Villain', amount: 0, potSizeAfter: 400 });
    if (showdown) {
      actions.push({ street: 'RIVER', actionType: 'SHOW_HAND', player: 'Hero', amount: 0, potSizeAfter: 400 });
      actions.push({ street: 'RIVER', actionType: 'SHOW_HAND', player: 'Villain', amount: 0, potSizeAfter: 400 });
    }
  }
  players.find(p => p.isHero).profitLoss = profitLoss;
  players.find(p => p.name === 'Villain').profitLoss = -profitLoss;
  return {
    handIndex, stakes: '$1/$2', currency: 'USD',
    players, actions,
    board: { flop: [], turn: [], river: [] },
    winners: heroWins ? ['Hero'] : ['Villain'],
  };
}

describe('computeStatsForHands: showdownBreakdown', () => {
  it('classifies each hand into won/lost x with/without showdown', () => {
    const hands = [
      hand({ handIndex: 1, heroWins: true, heroFolds: false, showdown: false, profitLoss: 100 }),
      hand({ handIndex: 2, heroWins: true, heroFolds: false, showdown: true, profitLoss: 200 }),
      hand({ handIndex: 3, heroWins: false, heroFolds: true, showdown: false, profitLoss: -100 }),
      hand({ handIndex: 4, heroWins: false, heroFolds: false, showdown: true, profitLoss: -300 }),
    ];
    const stats = computeStatsForHands(hands, matchHero());
    expect(stats.showdownBreakdown).toEqual({
      wonNoShowdown: 1,
      wonAtShowdown: 1,
      lostNoShowdown: 1,
      lostAtShowdown: 1,
    });
  });
});

describe('computeStatsForHands: per-position profitability', () => {
  it('attaches totalProfitLoss/bb100/currency to a position bucket, same as the top level', () => {
    const hands = [
      hand({ handIndex: 1, heroWins: true, heroFolds: false, showdown: false, profitLoss: 100 }),
      hand({ handIndex: 2, heroWins: true, heroFolds: false, showdown: true, profitLoss: 200 }),
      hand({ handIndex: 3, heroWins: false, heroFolds: true, showdown: false, profitLoss: -100 }),
      hand({ handIndex: 4, heroWins: false, heroFolds: false, showdown: true, profitLoss: -300 }),
    ];
    const stats = computeStatsForHands(hands, matchHero());
    // All 4 hands are 2-handed with hero on the button -> one bucket.
    const posBucket = stats.positional[2]?.positions?.['BTN/SB'];
    expect(posBucket).toBeTruthy();
    // Net profitLoss across the 4 hands: 100+200-100-300 = -100 cents = -$1.00 (major units).
    expect(posBucket.totalProfitLoss).toBe(-1);
    expect(posBucket.currency).toBe('USD');
    expect(posBucket.bb100).not.toBeNull();
  });
});
