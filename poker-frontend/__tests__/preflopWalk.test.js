import { describe, it, expect } from 'vitest';
import { computeWalk } from '../src/utils/preflopWalk.js';
import { SEATS_BY_SIZE } from '../src/utils/handGrid.js';

const SEATS = SEATS_BY_SIZE[6];

// Builds a path step the way PreflopMatrixPage.jsx does when committing a
// decision: {position, scenario, facingPosition, action}.
function step(position, scenario, facingPosition, action) {
  return { position, scenario, facingPosition, action };
}

// openSeats[0] is the immediate next seat to act - the old single
// "frontier" concept, still useful as a shorthand in most of these tests.
function next(walk) {
  return walk.openSeats[0];
}

describe('computeWalk', () => {
  it('opens with every seat UTG->BB as one RFI round', () => {
    const walk = computeWalk([]);
    expect(walk.complete).toBe(false);
    expect(walk.openSeats).toEqual(SEATS.map(position => ({ position, scenario: 'rfi', facingPosition: null })));
  });

  it('everyone folding around to BB (unraised) completes the hand', () => {
    const path = SEATS.slice(0, 5).map(pos => step(pos, 'rfi', null, 'fold'));
    // UTG..SB fold, BB is left - still needs to act (their free option) since only folds happened before them.
    const walk = computeWalk(path);
    expect(walk.complete).toBe(false);
    expect(next(walk)).toEqual({ position: 'BB', scenario: 'rfi', facingPosition: null });
  });

  it('a checked-through pot (everyone calls/checks, BB checks) completes the hand', () => {
    const path = SEATS.map(pos => step(pos, 'rfi', null, 'call'));
    const walk = computeWalk(path);
    expect(walk.complete).toBe(true);
  });

  it('a raise starts a new round: every remaining live seat is open, all facing the raiser', () => {
    const walk = computeWalk([step('UTG', 'rfi', null, 'raise')]);
    expect(walk.complete).toBe(false);
    expect(walk.openSeats).toEqual(
      ['HJ', 'CO', 'BTN', 'SB', 'BB'].map(position => ({ position, scenario: 'vsOpen', facingPosition: 'UTG' }))
    );
  });

  it('folds after an open keep everyone else facing the same opener, until the action returns to the raiser', () => {
    const path = [
      step('UTG', 'rfi', null, 'raise'),
      step('HJ', 'vsOpen', 'UTG', 'fold'),
      step('CO', 'vsOpen', 'UTG', 'fold'),
      step('BTN', 'vsOpen', 'UTG', 'fold'),
      step('SB', 'vsOpen', 'UTG', 'fold'),
    ];
    const walk = computeWalk(path);
    expect(walk.complete).toBe(false);
    expect(walk.openSeats).toEqual([{ position: 'BB', scenario: 'vsOpen', facingPosition: 'UTG' }]);
  });

  it('everyone folding to the raiser (no calls) completes the hand uncontested', () => {
    const path = [
      step('UTG', 'rfi', null, 'raise'),
      step('HJ', 'vsOpen', 'UTG', 'fold'),
      step('CO', 'vsOpen', 'UTG', 'fold'),
      step('BTN', 'vsOpen', 'UTG', 'fold'),
      step('SB', 'vsOpen', 'UTG', 'fold'),
      step('BB', 'vsOpen', 'UTG', 'fold'),
    ];
    const walk = computeWalk(path);
    expect(walk.complete).toBe(true);
    expect([...walk.folded].sort()).toEqual(['BB', 'CO', 'HJ', 'SB', 'BTN'].sort());
  });

  it('a 3-bet reopens action to a seat that already called the open earlier in the same round', () => {
    // UTG opens, HJ calls (cold call), CO 3-bets - HJ must act again, now
    // facing the 3-bet (vs3Bet), even though they already acted this "round".
    const path = [
      step('UTG', 'rfi', null, 'raise'),
      step('HJ', 'vsOpen', 'UTG', 'call'),
      step('CO', 'vsOpen', 'UTG', 'raise'),
    ];
    const walk = computeWalk(path);
    expect(walk.complete).toBe(false);
    // Everyone still live after CO (the new raiser), wrapping around: BTN, SB, BB, UTG, then HJ.
    expect(walk.openSeats).toEqual(
      ['BTN', 'SB', 'BB', 'UTG', 'HJ'].map(position => ({ position, scenario: 'vs3Bet', facingPosition: 'CO' }))
    );
  });

  it('reproduces the deep re-raise example: UTG opens, gets 3-bet by SB, 4-bets, SB 5-bets, UTG folds', () => {
    // Same shape as the backend statsEngine.test.js unbounded-depth test.
    let path = [
      step('UTG', 'rfi', null, 'raise'),
      step('HJ', 'vsOpen', 'UTG', 'fold'),
      step('CO', 'vsOpen', 'UTG', 'fold'),
      step('BTN', 'vsOpen', 'UTG', 'fold'),
      step('SB', 'vsOpen', 'UTG', 'raise'),
    ];
    let walk = computeWalk(path);
    expect(next(walk)).toEqual({ position: 'BB', scenario: 'vs3Bet', facingPosition: 'SB' });

    path = [...path, step('BB', 'vs3Bet', 'SB', 'fold')];
    walk = computeWalk(path);
    expect(next(walk)).toEqual({ position: 'UTG', scenario: 'vs3Bet', facingPosition: 'SB' });

    path = [...path, step('UTG', 'vs3Bet', 'SB', 'raise')];
    walk = computeWalk(path);
    expect(next(walk)).toEqual({ position: 'SB', scenario: 'vs4Bet', facingPosition: 'UTG' });

    path = [...path, step('SB', 'vs4Bet', 'UTG', 'raise')];
    walk = computeWalk(path);
    expect(next(walk)).toEqual({ position: 'UTG', scenario: 'vs5Bet', facingPosition: 'SB' });

    path = [...path, step('UTG', 'vs5Bet', 'SB', 'fold')];
    walk = computeWalk(path);
    expect(walk.complete).toBe(true);
  });

  it('a late raise (BB) reopens action back to UTG, wrapping around the table', () => {
    const path = [
      step('UTG', 'rfi', null, 'fold'),
      step('HJ', 'rfi', null, 'fold'),
      step('CO', 'rfi', null, 'fold'),
      step('BTN', 'rfi', null, 'fold'),
      step('SB', 'rfi', null, 'fold'),
      step('BB', 'rfi', null, 'raise'),
    ];
    const walk = computeWalk(path);
    // Everyone else already folded, so BB's raise has no one left to act -
    // the hand ends uncontested despite BB technically "opening".
    expect(walk.complete).toBe(true);
  });

  it('accepts an explicit 8-max seat list, inserting UTG+1/UTG+2 into the acting order', () => {
    const seats8 = SEATS_BY_SIZE[8];
    expect(next(computeWalk([], seats8))).toEqual({ position: 'UTG', scenario: 'rfi', facingPosition: null });

    const walk = computeWalk([step('UTG', 'rfi', null, 'raise')], seats8);
    expect(next(walk)).toEqual({ position: 'UTG+1', scenario: 'vsOpen', facingPosition: 'UTG' });
  });

  it('accepts an explicit 9-max seat list, inserting LJ between UTG+2 and HJ', () => {
    const seats9 = SEATS_BY_SIZE[9];
    expect(seats9).toEqual(['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);

    const path = [
      step('UTG', 'rfi', null, 'fold'),
      step('UTG+1', 'rfi', null, 'fold'),
      step('UTG+2', 'rfi', null, 'fold'),
    ];
    const walk = computeWalk(path, seats9);
    expect(next(walk)).toEqual({ position: 'LJ', scenario: 'rfi', facingPosition: null });
  });
});
