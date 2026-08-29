import { describe, it, expect } from 'vitest';
import { parseACRLog } from '../utils/ACRPokerParser.js';
import { simulateEquity } from '../utils/equityEngine.js';

// Full-pipeline regression test: raw ACR hand-history TEXT -> parseACRLog
// (which wires in computeHandProfits/detectAllIn/computeAllInEV exactly
// as the real upload path does) -> the resulting hand doc's isAllIn/
// allInEV. Unit tests elsewhere (evCalculator.test.js) exercise
// computeAllInEV against hand-built JS objects; this instead exercises
// the real regex-based text parser, which is where a format assumption
// can quietly diverge from what the parser actually produces - e.g. an
// earlier version of evCalculator.js assumed board.turn/river held only
// the newest card, when both real parsers actually store the whole
// board-to-date (this test's hand only has a flop-street all-in, but the
// dedicated turn-street regression lives in evCalculator.test.js).

function heroWinsAtFlopShowdown() {
  return `Hand #100001 - Holdem(No Limit) - $1/$2 - 2026/01/01 12:00:00 UTC
Table 'RegressionTable' 2-max Seat #1 is the button
Seat 1: Hero ($5.00)
Seat 2: Villain ($5.00)
Hero posts the small blind $0.05
Villain posts the big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [7h 7d]
Hero raises $0.20 to $0.30
Villain calls $0.20
*** FLOP *** [7c 2h 3d]
Villain checks
Hero bets $4.70
Villain calls $4.70
*** TURN *** [7c 2h 3d] [9s]
*** RIVER *** [7c 2h 3d 9s] [4c]
*** SHOW DOWN ***
Hero shows [7h 7d] (three of a kind, Sevens)
Villain shows [Kc Kd] (a pair of Kings)
*** SUMMARY ***
Total pot $10.00 | Rake $0.00
Board [7c 2h 3d 9s 4c]
Seat 1: Hero (small blind) showed [7h 7d] and won $10.00 with three of a kind, Sevens
Seat 2: Villain (big blind) showed [Kc Kd] and lost with a pair of Kings
`;
}

// Same flop spot, but the declared pot winner (via the SUMMARY line, which
// is all the parser reads to determine winnings) is Villain - hero was a
// heavy favorite on the flop shove but the hand is scripted as a loss, so
// actualResult and allInEV should genuinely diverge. This is exactly the
// case item 4e's profit-vs-EV graph exists to surface.
function heroBadBeat() {
  return `Hand #100002 - Holdem(No Limit) - $1/$2 - 2026/01/01 12:05:00 UTC
Table 'RegressionTable' 2-max Seat #1 is the button
Seat 1: Hero ($5.00)
Seat 2: Villain ($5.00)
Hero posts the small blind $0.05
Villain posts the big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [7h 7d]
Hero raises $0.20 to $0.30
Villain calls $0.20
*** FLOP *** [7c 2h 3d]
Villain checks
Hero bets $4.70
Villain calls $4.70
*** TURN *** [7c 2h 3d] [2s]
*** RIVER *** [7c 2h 3d 2s] [Kh]
*** SHOW DOWN ***
Hero shows [7h 7d] (a full house, Sevens full of Deuces)
Villain shows [Kc Kd] (a full house, Kings full of Deuces)
*** SUMMARY ***
Total pot $10.00 | Rake $0.00
Board [7c 2h 3d 2s Kh]
Seat 1: Hero (small blind) showed [7h 7d] and lost with a full house, Sevens full of Deuces
Seat 2: Villain (big blind) showed [Kc Kd] and won $10.00 with a full house, Kings full of Deuces
`;
}

describe('end-to-end: raw ACR text -> parse -> isAllIn -> allInEV', () => {
  it('detects the all-in and computes a correct allInEV when hero wins', () => {
    const [hand] = parseACRLog(heroWinsAtFlopShowdown());
    const hero = hand.players.find(p => p.isHero);

    expect(hand.isAllIn).toBe(true);
    expect(hero.profitLoss).toBe(500); // won $10.00 pot, invested $5.00 -> +$5.00 net, in cents

    const [heroEquity] = simulateEquity([['7h', '7d'], ['Kc', 'Kd']], ['7c', '2h', '3d']);
    const expectedEV = heroEquity * 1000 - 500;
    expect(hand.allInEV).toBeCloseTo(expectedEV, 10);
  });

  it('computes a POSITIVE allInEV for hero even though she actually lost the hand (the bad-beat case)', () => {
    const [hand] = parseACRLog(heroBadBeat());
    const hero = hand.players.find(p => p.isHero);

    expect(hand.isAllIn).toBe(true);
    expect(hero.profitLoss).toBe(-500); // lost the whole $5.00 stack

    const [heroEquity] = simulateEquity([['7h', '7d'], ['Kc', 'Kd']], ['7c', '2h', '3d']);
    const expectedEV = heroEquity * 1000 - 500;
    expect(hand.allInEV).toBeCloseTo(expectedEV, 10);

    // The whole point of items 4d/4e: hero was a big flop favorite, so EV
    // is strongly positive, even though the actual result (profitLoss)
    // was a big loss - the two numbers are meant to diverge here.
    expect(hand.allInEV).toBeGreaterThan(0);
    expect(hand.allInEV).not.toBeCloseTo(hero.profitLoss, 0);
  });
});
