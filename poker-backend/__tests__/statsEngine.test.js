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

describe('computeStatsForHands: per-position foldToSteal/limp/coldCall (Study\'s preflop matrix)', () => {
  it('mirrors foldToSteal, limp, and coldCall into the position bucket the same way checkRaise/wsd already do', () => {
    // Hand 1: Villain (BTN, a steal position) opens, Hero (BB, a blind
    // position) folds - a fold to steal.
    const foldToStealHand = {
      handIndex: 1, stakes: '$1/$2', currency: 'USD',
      players: [
        { seat: 1, name: 'Villain', stack: 40000, isDealer: true, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: 300 },
        { seat: 2, name: 'SBPlayer', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
        { seat: 3, name: 'Hero', stack: 40000, isDealer: false, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: -200 },
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Hero', amount: 200, potSizeAfter: 300 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 600, potSizeAfter: 900 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 900 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 900 },
      ],
      board: { flop: [], turn: [], river: [] },
      winners: ['Villain'],
    };

    // Hand 2: Hero (BTN) limps.
    const limpHand = {
      handIndex: 2, stakes: '$1/$2', currency: 'USD',
      players: [
        { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
        { seat: 2, name: 'SBPlayer', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: 0 },
        { seat: 3, name: 'Villain', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: 100 },
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 200, potSizeAfter: 300 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 200, potSizeAfter: 500 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 500 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'Villain', amount: 0, potSizeAfter: 500 },
      ],
      board: { flop: [], turn: [], river: [] },
      winners: ['Hero'],
    };

    // Hand 3: Villain (BTN) opens, Hero (BB) cold calls.
    const coldCallHand = {
      handIndex: 3, stakes: '$1/$2', currency: 'USD',
      players: [
        { seat: 1, name: 'Villain', stack: 40000, isDealer: true, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -300 },
        { seat: 2, name: 'SBPlayer', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
        { seat: 3, name: 'Hero', stack: 40000, isDealer: false, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: 400 },
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Hero', amount: 200, potSizeAfter: 300 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 600, potSizeAfter: 900 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 900 },
        { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 400, potSizeAfter: 1300 },
      ],
      board: { flop: [], turn: [], river: [] },
      winners: ['Hero'],
    };

    const stats = computeStatsForHands([foldToStealHand, limpHand, coldCallHand], matchHero());

    // Both hand 1 and hand 3 face a BTN steal from the BB - hand 1 folds
    // (the "made" case), hand 3 cold calls instead, so BB's foldToSteal
    // opportunity count spans both hands while only hand 1 counts as made.
    expect(stats.positional[3].positions.BB.foldToSteal).toEqual(expect.objectContaining({ made: 1, opportunities: 2 }));
    expect(stats.positional[3].positions.BTN.limp).toEqual(expect.objectContaining({ made: 1, opportunities: 1 }));
    expect(stats.positional[3].positions.BB.coldCall).toEqual(expect.objectContaining({ made: 1, opportunities: 1 }));
  });
});

describe('computeStatsForHands: win rate by hand class', () => {
  it('buckets an open by hand class, category, and position', () => {
    // 3-handed: Hero (BTN, dealer) opens AKs, both blinds fold.
    const players = [
      { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: 300, holeCards: ['Ah', 'Kh'] },
      { seat: 2, name: 'V1', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
      { seat: 3, name: 'V2', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -200 },
    ];
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'V1', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'V2', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'V1', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'V2', amount: 0, potSizeAfter: 900 },
    ];
    const hand = {
      handIndex: 1, stakes: '$1/$2', currency: 'USD',
      players, actions,
      board: { flop: [], turn: [], river: [] },
      winners: ['Hero'],
    };

    const stats = computeStatsForHands([hand], matchHero());

    expect(stats.byHandClassCategory.axSuited).toEqual(expect.objectContaining({ hands: 1 }));
    expect(stats.byHandClass.AKs.category).toBe('axSuited');
    expect(stats.byHandClass.AKs.contexts.open).toEqual(expect.objectContaining({ hands: 1 }));
    expect(stats.byHandClass.AKs.contexts.open.byPosition.BTN).toEqual(expect.objectContaining({ hands: 1 }));
    expect(stats.byHandClass.AKs.contexts.open.byPosition.BTN.totalProfitLoss).toBeGreaterThan(0);
  });

  it('classifies hero 3-betting then folding to a 4-bet, and skips hands hero never voluntarily played', () => {
    // 2-handed: Villain (BTN/SB) opens, Hero (BB) 3-bets with 76s, Villain
    // 4-bets, Hero folds - the "loses every time from a 4-bet" spot.
    const playedHand = {
      handIndex: 1, stakes: '$1/$2', currency: 'USD',
      players: [
        { seat: 1, name: 'Villain', stack: 40000, isDealer: true, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: 900 },
        { seat: 2, name: 'Hero', stack: 40000, isDealer: false, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: -900, holeCards: ['7h', '6h'] },
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Villain', amount: 100, potSizeAfter: 100 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Hero', amount: 200, potSizeAfter: 300 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 600, potSizeAfter: 900 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 1800, potSizeAfter: 2700 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 5400, potSizeAfter: 8100 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 8100 },
      ],
      board: { flop: [], turn: [], river: [] },
      winners: ['Villain'],
    };

    // A hand hero folded first-in with zero voluntary investment - should
    // contribute no byHandClass data at all (see classifyHeroPreflopContext's
    // null-context rule).
    const foldedHand = {
      handIndex: 2, stakes: '$1/$2', currency: 'USD',
      players: [
        { seat: 1, name: 'Villain', stack: 40000, isDealer: true, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: 200 },
        { seat: 2, name: 'Hero', stack: 40000, isDealer: false, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: -200, holeCards: ['2c', '7d'] },
      ],
      actions: [
        { street: 'PREFLOP', actionType: 'POST_SB', player: 'Villain', amount: 100, potSizeAfter: 100 },
        { street: 'PREFLOP', actionType: 'POST_BB', player: 'Hero', amount: 200, potSizeAfter: 300 },
        { street: 'PREFLOP', actionType: 'RAISE', player: 'Villain', amount: 600, potSizeAfter: 900 },
        { street: 'PREFLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 900 },
      ],
      board: { flop: [], turn: [], river: [] },
      winners: ['Villain'],
    };

    const stats = computeStatsForHands([playedHand, foldedHand], matchHero());

    expect(stats.byHandClass['76s'].category).toBe('suitedConnectors');
    expect(stats.byHandClass['76s'].contexts.foldTo4Bet).toEqual(expect.objectContaining({ hands: 1 }));
    expect(stats.byHandClass['76s'].contexts.foldTo4Bet.totalProfitLoss).toBeLessThan(0);
    // Confirms the deepest action (the fold to the 4-bet) supersedes the
    // earlier 3-bet label for this hand - only one context bucket exists.
    expect(stats.byHandClass['76s'].contexts.threeBet).toBeUndefined();

    expect(stats.byHandClass['72o']).toBeUndefined();
  });
});

describe('computeStatsForHands: preflopMatrix (range-matrix grid)', () => {
  // 6-max seating with seat 1 as dealer: seat1=BTN, seat2=SB, seat3=BB,
  // seat4=UTG, seat5=HJ, seat6=CO (getPositionMap's seat-offset-from-dealer
  // assignment, POSITIONS_BY_SIZE[6]).
  function sixMaxPlayers(heroSeat, heroHoleCards) {
    const names = { 1: 'BTNPlayer', 2: 'SBPlayer', 3: 'BBPlayer', 4: 'UTGPlayer', 5: 'HJPlayer', 6: 'COPlayer' };
    return [1, 2, 3, 4, 5, 6].map(seat => ({
      seat,
      name: seat === heroSeat ? 'Hero' : names[seat],
      stack: 40000,
      isDealer: seat === 1,
      isHero: seat === heroSeat,
      isSittingOut: false,
      effectiveStackBB: 100,
      profitLoss: seat === heroSeat ? -100 : 20,
      holeCards: seat === heroSeat ? heroHoleCards : [],
    }));
  }

  it('records an RFI raise when hero opens first-in', () => {
    const players = sixMaxPlayers(4, ['Ah', 'Kh']); // Hero UTG, AKs
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'BBPlayer', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'HJPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'COPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BTNPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BBPlayer', amount: 0, potSizeAfter: 900 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: [], turn: [], river: [] }, winners: ['Hero'] }], matchHero());

    expect(stats.preflopMatrix['6'].rfi.UTG.AKs).toEqual(expect.objectContaining({ raise: 1, fold: 0, call: 0, total: 1, raisePct: 100 }));
  });

  it('records an RFI fold when hero folds first-in, even with zero voluntary investment', () => {
    // classifyHeroPreflopContext excludes this hand entirely (see the
    // byHandClass test above), but the range-matrix needs it to compute an
    // accurate fold%.
    const players = sixMaxPlayers(4, ['7c', '2d']); // Hero UTG, 72o
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'BBPlayer', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'HJPlayer', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'COPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BTNPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BBPlayer', amount: 0, potSizeAfter: 900 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: [], turn: [], river: [] }, winners: ['HJPlayer'] }], matchHero());

    expect(stats.preflopMatrix['6'].rfi.UTG['72o']).toEqual(expect.objectContaining({ fold: 1, raise: 0, call: 0, total: 1, foldPct: 100 }));
    // Confirmed excluded from byHandClass, per the null-context rule above.
    expect(stats.byHandClass['72o']).toBeUndefined();
  });

  it('records a vsOpen call, keyed by hero position then the opener\'s position', () => {
    const players = sixMaxPlayers(3, ['9h', '8h']); // Hero BB, 98s
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'Hero', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'UTGPlayer', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'HJPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'COPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BTNPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 400, potSizeAfter: 1300 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: ['2c', '5d', '9s'], turn: [], river: [] }, winners: ['Hero'] }], matchHero());

    expect(stats.preflopMatrix['6'].vsOpen.BB.UTG['98s']).toEqual(expect.objectContaining({ call: 1, fold: 0, raise: 0, total: 1, callPct: 100 }));
  });

  it('records both an RFI raise and a vs3Bet fold from the same hand (hero opens, gets 3-bet, folds)', () => {
    const players = sixMaxPlayers(4, ['Qc', 'Qd']); // Hero UTG, QQ
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'BBPlayer', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'HJPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'COPlayer', amount: 1800, potSizeAfter: 2700 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BTNPlayer', amount: 0, potSizeAfter: 2700 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 2700 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BBPlayer', amount: 0, potSizeAfter: 2700 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 2700 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: [], turn: [], river: [] }, winners: ['COPlayer'] }], matchHero());

    expect(stats.preflopMatrix['6'].rfi.UTG.QQ).toEqual(expect.objectContaining({ raise: 1, total: 1 }));
    expect(stats.preflopMatrix['6'].vs3Bet.UTG.CO.QQ).toEqual(expect.objectContaining({ fold: 1, total: 1 }));
  });

  it('supports unbounded depth: an RFI raise, a vs3Bet 4-bet, and a vs5Bet fold, all from one hand', () => {
    // Hero (UTG) opens, SB 3-bets, Hero 4-bets, SB 5-bet jams, Hero folds.
    // Exercises matrixScenarioForLevel beyond the old hardcoded level<=2 cap
    // - hero's own 4-bet doesn't produce a "vs4Bet" entry (that scenario
    // belongs to whoever responds to hero's 4-bet, not hero), but hero's
    // next decision (facing the 5-bet) correctly lands in vs5Bet.
    const players = sixMaxPlayers(4, ['Qc', 'Qd']); // Hero UTG, QQ
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'BBPlayer', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'HJPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'COPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BTNPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'SBPlayer', amount: 1800, potSizeAfter: 2700 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BBPlayer', amount: 0, potSizeAfter: 2700 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 5400, potSizeAfter: 8100 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'SBPlayer', amount: 20000, potSizeAfter: 28100 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'Hero', amount: 0, potSizeAfter: 28100 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: [], turn: [], river: [] }, winners: ['SBPlayer'] }], matchHero());

    expect(stats.preflopMatrix['6'].rfi.UTG.QQ).toEqual(expect.objectContaining({ raise: 1, total: 1 }));
    expect(stats.preflopMatrix['6'].vs3Bet.UTG.SB.QQ).toEqual(expect.objectContaining({ raise: 1, total: 1 }));
    expect(stats.preflopMatrix['6'].vs4Bet).toBeUndefined();
    expect(stats.preflopMatrix['6'].vs5Bet.UTG.SB.QQ).toEqual(expect.objectContaining({ fold: 1, total: 1 }));
  });

  it('does not populate preflopMatrix for table sizes outside 6-9', () => {
    const players = [
      { seat: 1, name: 'Hero', stack: 40000, isDealer: true, isHero: true, isSittingOut: false, effectiveStackBB: 200, profitLoss: 100, holeCards: ['Ah', 'Kh'] },
      { seat: 2, name: 'Villain', stack: 40000, isDealer: false, isHero: false, isSittingOut: false, effectiveStackBB: 200, profitLoss: -100 },
    ];
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'Hero', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'Villain', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'Villain', amount: 0, potSizeAfter: 900 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: [], turn: [], river: [] }, winners: ['Hero'] }], matchHero());

    expect(stats.preflopMatrix['2']).toBeUndefined();
  });

  it('populates preflopMatrix for 8-handed tables too, with the extra UTG+1/UTG+2 positions', () => {
    // Seat 1 = dealer = BTN, then SB/BB/UTG/UTG+1/UTG+2/HJ/CO in seat order
    // (POSITIONS_BY_SIZE[8], same seat-offset-from-dealer assignment as the
    // 6-max helper above).
    const names = { 1: 'BTNPlayer', 2: 'SBPlayer', 3: 'BBPlayer', 4: 'UTGPlayer', 5: 'UTG1Player', 6: 'UTG2Player', 7: 'HJPlayer', 8: 'COPlayer' };
    const heroSeat = 6; // UTG+2
    const players = [1, 2, 3, 4, 5, 6, 7, 8].map(seat => ({
      seat,
      name: seat === heroSeat ? 'Hero' : names[seat],
      stack: 40000,
      isDealer: seat === 1,
      isHero: seat === heroSeat,
      isSittingOut: false,
      effectiveStackBB: 100,
      profitLoss: seat === heroSeat ? -100 : 20,
      holeCards: seat === heroSeat ? ['Jc', 'Jd'] : [],
    }));
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'BBPlayer', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'UTGPlayer', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'UTG1Player', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'CALL', player: 'Hero', amount: 600, potSizeAfter: 1500 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'HJPlayer', amount: 0, potSizeAfter: 1500 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'COPlayer', amount: 0, potSizeAfter: 1500 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BTNPlayer', amount: 0, potSizeAfter: 1500 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 1500 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BBPlayer', amount: 0, potSizeAfter: 1500 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: [], turn: [], river: [] }, winners: ['Hero'] }], matchHero());

    expect(stats.preflopMatrix['8'].vsOpen['UTG+2'].UTG.JJ).toEqual(expect.objectContaining({ call: 1, total: 1 }));
  });

  it('populates preflopMatrix for 9-handed tables too, with the LJ position', () => {
    // Seat 1 = dealer = BTN, then SB/BB/UTG/UTG+1/UTG+2/LJ/HJ/CO in seat
    // order (POSITIONS_BY_SIZE[9]).
    const names = { 1: 'BTNPlayer', 2: 'SBPlayer', 3: 'BBPlayer', 4: 'UTGPlayer', 5: 'UTG1Player', 6: 'UTG2Player', 7: 'LJPlayer', 8: 'HJPlayer', 9: 'COPlayer' };
    const heroSeat = 7; // LJ
    const players = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(seat => ({
      seat,
      name: seat === heroSeat ? 'Hero' : names[seat],
      stack: 40000,
      isDealer: seat === 1,
      isHero: seat === heroSeat,
      isSittingOut: false,
      effectiveStackBB: 100,
      profitLoss: seat === heroSeat ? 300 : -30,
      holeCards: seat === heroSeat ? ['Tc', 'Td'] : [],
    }));
    const actions = [
      { street: 'PREFLOP', actionType: 'POST_SB', player: 'SBPlayer', amount: 100, potSizeAfter: 100 },
      { street: 'PREFLOP', actionType: 'POST_BB', player: 'BBPlayer', amount: 200, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'UTGPlayer', amount: 0, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'UTG1Player', amount: 0, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'UTG2Player', amount: 0, potSizeAfter: 300 },
      { street: 'PREFLOP', actionType: 'RAISE', player: 'Hero', amount: 600, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'HJPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'COPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BTNPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'SBPlayer', amount: 0, potSizeAfter: 900 },
      { street: 'PREFLOP', actionType: 'FOLD', player: 'BBPlayer', amount: 0, potSizeAfter: 900 },
    ];
    const stats = computeStatsForHands([{ handIndex: 1, stakes: '$1/$2', currency: 'USD', players, actions, board: { flop: [], turn: [], river: [] }, winners: ['Hero'] }], matchHero());

    expect(stats.preflopMatrix['9'].rfi.LJ.TT).toEqual(expect.objectContaining({ raise: 1, total: 1 }));
  });
});
