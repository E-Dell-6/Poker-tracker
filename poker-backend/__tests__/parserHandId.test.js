import { describe, it, expect } from 'vitest';
import { parsePokerLog } from '../utils/parsePokerLog.js';

// Two things this locks in.
//
// 1. The site's hand id is captured. Both parsers already matched it in
//    their header regex and threw it away; per-hand dedup depends on it, so
//    a regression here would silently restore the double-counting bug.
// 2. computeEv defaults to TRUE. Bulk imports pass false and run EV
//    separately with yields, but every other caller - and the rest of the
//    test suite - depends on the original inline behavior.

function ggLog() {
  return `Poker Hand #HD777001: Hold'em No Limit ($0.05/$0.1) - 2026/01/01 12:00:00
Table 'T1' 2-max Seat #1 is the button
Seat 1: Hero ($5.00 in chips)
Seat 2: villain ($5.00 in chips)
Hero: posts small blind $0.05
villain: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [Ah Ad]
Dealt to villain
Hero: raises $4.90 to $5.00 and is all-in
villain: calls $4.90 and is all-in
*** FLOP *** [2c 7h 9d]
*** TURN *** [2c 7h 9d] [3s]
*** RIVER *** [2c 7h 9d 3s] [4c]
Hero: shows [Ah Ad] (a pair of Aces)
villain: shows [Kh Kd] (a pair of Kings)
*** SHOWDOWN ***
Hero collected $10.00 from pot
*** SUMMARY ***
Total pot $10 | Rake $0
Board [2c 7h 9d 3s 4c]
Seat 1: Hero (small blind) showed [Ah Ad] and won ($10.00) with a pair of Aces
Seat 2: villain (big blind) showed [Kh Kd] and lost with a pair of Kings

Poker Hand #HD777002: Hold'em No Limit ($0.05/$0.1) - 2026/01/01 12:01:00
Table 'T1' 2-max Seat #2 is the button
Seat 1: Hero ($5.00 in chips)
Seat 2: villain ($5.00 in chips)
villain: posts small blind $0.05
Hero: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [2h 3h]
villain: folds
*** SUMMARY ***
Total pot $0.1 | Rake $0
Seat 1: Hero (big blind) collected ($0.10)
`;
}

function acrLog() {
  return `Hand #A55501 - Holdem - $0.05/$0.1 - 2026/01/01 12:00:00 UTC
Table '5' 6-max Seat #1 is the button
Seat 1: Hero ($5.00)
Seat 2: opp ($5.00)
Hero: posts small blind $0.05
opp: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
Hero: folds
*** SUMMARY ***
Total pot $0.15
`;
}

describe('site hand id capture', () => {
  it('records GGPoker hand ids on every parsed hand', () => {
    const { format, hands } = parsePokerLog(ggLog());
    expect(format).toBe('GGPOKER');
    expect(hands.map(h => h.handId)).toEqual(['HD777001', 'HD777002']);
  });

  it('records the ACR hand id', () => {
    const { format, hands } = parsePokerLog(acrLog());
    expect(format).toBe('ACR');
    expect(hands[0].handId).toBe('A55501');
  });

  it('leaves handId null for PokerNow, which has no site hand id', () => {
    const csv = 'entry,at,order\n"-- starting hand #1 (No Limit Texas Hold\'em) --",1,1\n';
    const { format, hands } = parsePokerLog(csv);
    expect(format).toBe('POKERNOW');
    for (const hand of hands) expect(hand.handId ?? null).toBeNull();
  });
});

describe('computeEv option', () => {
  it('computes all-in EV by default', () => {
    const { hands } = parsePokerLog(ggLog());
    // First hand is an all-in showdown with both hole cards known, so EV
    // is computable; the second is a preflop fold and stays null.
    expect(typeof hands[0].allInEV).toBe('number');
    expect(hands[1].allInEV).toBeNull();
  });

  it('skips EV when asked, leaving allInEV null instead of undefined', () => {
    const { hands } = parsePokerLog(ggLog(), { computeEv: false });
    expect(hands[0].allInEV).toBeNull();
    expect(hands[1].allInEV).toBeNull();
    // Everything else the parser derives must still be present - only the
    // equity simulation is deferred.
    expect(hands[0].isAllIn).toBe(true);
    expect(hands[0].players.find(p => p.isHero).profitLoss).toBeTypeOf('number');
  });

  it('produces identical hands either way apart from allInEV', () => {
    const withEv = parsePokerLog(ggLog()).hands;
    const withoutEv = parsePokerLog(ggLog(), { computeEv: false }).hands;

    const strip = (hands) => hands.map(({ allInEV, _id, ...rest }) => rest);
    expect(strip(withoutEv)).toEqual(strip(withEv));
  });
});
