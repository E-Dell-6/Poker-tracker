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

describe('computeStatsForHands: per-position hands/checkRaise/wsd/aggFactor (Study\'s postflop matrix)', () => {
  it('counts hands per position and mirrors checkRaise/wsd/aggression into the position bucket', () => {
    // Hero (BTN/SB, 2-handed): calls preflop, then check-raises the flop
    // and gets there via a call - exercises checkRaise, aggBets/aggCalls
    // (for AF), and wsd (reaches and wins at showdown) all in one hand.
    const players = [
      { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: 500 },
      { seat: 2, name: 'Villain', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -500 },
    ];
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 100, potSizeAfter: 400 },
      { street: 'PREFLOP', actionType: 'CHECK', player: 'Villain', amount: 0, potSizeAfter: 400 },
      { street: 'FLOP', actionType: 'CHECK', player: 'Hero', amount: 0, potSizeAfter: 400 },
      { street: 'FLOP', actionType: 'BET', player: 'Villain', amount: 200, potSizeAfter: 600 },
      { street: 'FLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 1200 },
      { street: 'FLOP', actionType: 'CALL', player: 'Villain', amount: 400, potSizeAfter: 1600 },
      { street: 'TURN', actionType: 'BET', player: 'Villain', amount: 300, potSizeAfter: 1900 },
      { street: 'TURN', actionType: 'CALL', player: 'Hero', amount: 300, potSizeAfter: 2200 },
      { street: 'RIVER', actionType: 'SHOW_HAND', player: 'Hero', amount: 0, potSizeAfter: 2200 },
      { street: 'RIVER', actionType: 'SHOW_HAND', player: 'Villain', amount: 0, potSizeAfter: 2200 },
    ];
    const singleHand = {
      handIndex: 1, stakes: '$1/$2', currency: 'USD',
      players, actions,
      board: { flop: ['7c', '2h', '3d'], turn: [], river: [] },
      winners: ['Hero'],
    };

    const stats = computeStatsForHands([singleHand], matchHero());
    const posBucket = stats.positional[2]?.positions?.['BTN/SB'];

    expect(posBucket.hands).toBe(1);
    expect(posBucket.checkRaise).toEqual(expect.objectContaining({ made: 1, opportunities: 1 }));
    expect(posBucket.wsd).toEqual(expect.objectContaining({ made: 1, opportunities: 1 }));
    // aggBets/aggCalls are postflop-only (same convention as the existing
    // top-level aggFactor - preflop action was never counted toward it).
    // Hero's postflop actions: flop raise (1 bet/raise), turn call (1
    // call) -> AF = 1/1 = 1.
    expect(posBucket.aggFactor).toBe(1);
  });
});

describe('computeStatsForHands: cbTurn/cbRiver (barrel chain)', () => {
  function barrelHand({ handIndex, checksFlopInstead }) {
    const players = [
      { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: 100 },
      { seat: 2, name: 'Villain', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
    ];
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'CALL', player: 'Villain', amount: 400, potSizeAfter: 1300 },
    ];
    if (checksFlopInstead) {
      // Hero checks the flop (no c-bet) - barrel chain should be dead, so
      // no cbTurn opportunity even though Hero was the preflop aggressor.
      actions.push({ street: 'FLOP', actionType: 'CHECK', player: 'Hero', amount: 0, potSizeAfter: 1300 });
      actions.push({ street: 'FLOP', actionType: 'CHECK', player: 'Villain', amount: 0, potSizeAfter: 1300 });
    } else {
      actions.push({ street: 'FLOP', actionType: 'BET', player: 'Hero', amount: 600, potSizeAfter: 1900 });
      actions.push({ street: 'FLOP', actionType: 'CALL', player: 'Villain', amount: 600, potSizeAfter: 2500 });
    }
    actions.push({ street: 'TURN', actionType: 'BET', player: 'Hero', amount: 800, potSizeAfter: 3300 });
    actions.push({ street: 'TURN', actionType: 'CALL', player: 'Villain', amount: 800, potSizeAfter: 4100 });
    actions.push({ street: 'RIVER', actionType: 'SHOW_HAND', player: 'Hero', amount: 0, potSizeAfter: 4100 });
    actions.push({ street: 'RIVER', actionType: 'SHOW_HAND', player: 'Villain', amount: 0, potSizeAfter: 4100 });
    return {
      handIndex, stakes: '$1/$2', currency: 'USD',
      players, actions,
      board: { flop: ['7c', '2h', '3d'], turn: [], river: [] },
      winners: ['Hero'],
    };
  }

  it('counts a cbTurn opportunity+made when the flop c-bet was made (barrel alive)', () => {
    const stats = computeStatsForHands([barrelHand({ handIndex: 1, checksFlopInstead: false })], matchHero());
    expect(stats.cbTurn).toEqual(expect.objectContaining({ made: 1, opportunities: 1 }));
  });

  it('does not count a cbTurn opportunity when the flop was checked (barrel chain broken)', () => {
    const stats = computeStatsForHands([barrelHand({ handIndex: 1, checksFlopInstead: true })], matchHero());
    expect(stats.cbTurn).toEqual(expect.objectContaining({ made: 0, opportunities: 0 }));
  });
});

describe('computeStatsForHands: donk bet', () => {
  it('counts a donk opportunity+made when the non-aggressor bets first into the actual aggressor', () => {
    // Villain raises preflop (is the aggressor). Hero calls. On the flop,
    // Hero (not the aggressor) bets first - a donk bet.
    const players = [
      { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
      { seat: 2, name: 'Villain', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: 100 },
    ];
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 400, potSizeAfter: 1300 },
      { street: 'FLOP', actionType: 'BET', player: 'Hero', amount: 600, potSizeAfter: 1900 },
      { street: 'FLOP', actionType: 'FOLD', player: 'Villain', amount: 0, potSizeAfter: 1900 },
    ];
    const hand = {
      handIndex: 1, stakes: '$1/$2', currency: 'USD',
      players, actions,
      board: { flop: ['7c', '2h', '3d'], turn: [], river: [] },
      winners: ['Hero'],
    };
    const stats = computeStatsForHands([hand], matchHero());
    expect(stats.donk).toEqual(expect.objectContaining({ made: 1, opportunities: 1 }));
  });
});

describe('computeStatsForHands: probe bet', () => {
  it('counts a probe opportunity+made when a checked-through street is followed by the non-aggressor betting first', () => {
    // Villain raises preflop (is the aggressor). Flop goes check-check.
    // On the turn, Hero (not the aggressor) bets first - a probe bet.
    const players = [
      { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: 100 },
      { seat: 2, name: 'Villain', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
    ];
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 400, potSizeAfter: 1300 },
      { street: 'FLOP', actionType: 'CHECK', player: 'Hero', amount: 0, potSizeAfter: 1300 },
      { street: 'FLOP', actionType: 'CHECK', player: 'Villain', amount: 0, potSizeAfter: 1300 },
      { street: 'TURN', actionType: 'BET', player: 'Hero', amount: 600, potSizeAfter: 1900 },
      { street: 'TURN', actionType: 'FOLD', player: 'Villain', amount: 0, potSizeAfter: 1900 },
    ];
    const hand = {
      handIndex: 1, stakes: '$1/$2', currency: 'USD',
      players, actions,
      board: { flop: ['7c', '2h', '3d'], turn: [], river: [] },
      winners: ['Hero'],
    };
    const stats = computeStatsForHands([hand], matchHero());
    expect(stats.probe).toEqual(expect.objectContaining({ made: 1, opportunities: 1 }));
  });
});
