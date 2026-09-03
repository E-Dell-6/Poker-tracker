import { describe, it, expect } from 'vitest';
import { parseGGPokerLog } from '../utils/GGPokerParser.js';
import { parsePokerLog } from '../utils/parsePokerLog.js';
import { simulateEquity } from '../utils/equityEngine.js';

// Fixtures are raw GGPoker hand-history TEXT, fed through the real
// parseGGPokerLog (which wires in computeHandProfits/detectAllIn/
// computeAllInEV exactly as the real upload path does), mirroring the
// inline-template-literal pattern evPipeline.e2e.test.js uses for ACR.

function heroWinsAtShowdown() {
  return `Poker Hand #HD100001: Hold'em No Limit ($0.05/$0.1) - 2026/01/01 12:00:00
Table 'RegressionTable' 2-max Seat #1 is the button
Seat 1: Hero ($5.00 in chips)
Seat 2: abc12345 ($5.00 in chips)
Hero: posts small blind $0.05
abc12345: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [7h 7d]
Dealt to abc12345
Hero: raises $0.2 to $0.3
abc12345: calls $0.2
*** FLOP *** [7c 2h 3d]
abc12345: checks
Hero: checks
*** TURN *** [7c 2h 3d] [9s]
abc12345: checks
Hero: checks
*** RIVER *** [7c 2h 3d 9s] [4c]
abc12345: checks
Hero: checks
Hero: shows [7h 7d] (three of a kind, Sevens)
abc12345: shows [Ah Ad] (a pair of Aces)
*** SHOWDOWN ***
Hero collected $999.00 from pot
*** SUMMARY ***
Total pot $0.6 | Rake $0.03 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0
Board [7c 2h 3d 9s 4c]
Seat 1: Hero (small blind) showed [7h 7d] and won ($0.57) with three of a kind, Sevens
Seat 2: abc12345 (big blind) showed [Ah Ad] and lost with a pair of Aces
`;
}

function heroWinsUncalledNoShowdown() {
  return `Poker Hand #HD100002: Hold'em No Limit ($0.05/$0.1) - 2026/01/01 12:05:00
Table 'RegressionTable' 2-max Seat #1 is the button
Seat 1: Hero ($5.00 in chips)
Seat 2: abc12345 ($5.00 in chips)
Hero: posts small blind $0.05
abc12345: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [Ah Ad]
Dealt to abc12345
Hero: raises $0.9 to $1.0
abc12345: folds
Uncalled bet ($0.9) returned to Hero
*** SHOWDOWN ***
Hero collected $0.2 from pot
*** SUMMARY ***
Total pot $0.2 | Rake $0 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0
Seat 1: Hero (small blind) collected ($0.2)
Seat 2: abc12345 (big blind) folded before Flop
`;
}

function heroAllInFlopShowdown() {
  return `Poker Hand #HD100003: Hold'em No Limit ($1/$2) - 2026/01/01 12:10:00
Table 'RegressionTable' 2-max Seat #1 is the button
Seat 1: Hero ($5.00 in chips)
Seat 2: abc12345 ($5.00 in chips)
Hero: posts small blind $0.05
abc12345: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [7h 7d]
Dealt to abc12345
Hero: raises $0.2 to $0.3
abc12345: calls $0.2
*** FLOP *** [7c 2h 3d]
abc12345: checks
Hero: bets $4.70 and is all-in
abc12345: calls $4.70
Hero: shows [7h 7d] (three of a kind, Sevens)
abc12345: shows [Kc Kd] (a pair of Kings)
*** TURN *** [7c 2h 3d] [9s]
*** RIVER *** [7c 2h 3d 9s] [4c]
*** SHOWDOWN ***
Hero collected $10.00 from pot
*** SUMMARY ***
Total pot $10.00 | Rake $0 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0
Board [7c 2h 3d 9s 4c]
Seat 1: Hero (small blind) showed [7h 7d] and won ($10.00) with three of a kind, Sevens
Seat 2: abc12345 (big blind) showed [Kc Kd] and lost with a pair of Kings
`;
}

function runItTwiceHand() {
  return `Poker Hand #HD100004: Hold'em No Limit ($1/$2) - 2026/01/01 12:15:00
Table 'RegressionTable' 2-max Seat #1 is the button
Seat 1: Hero ($5.00 in chips)
Seat 2: abc12345 ($5.00 in chips)
Hero: posts small blind $0.05
abc12345: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [Ah Ac]
Dealt to abc12345
Hero: raises $4.95 to $5.00 and is all-in
abc12345: calls $4.90 and is all-in
Hero: shows [Ah Ac] (a pair of Aces)
abc12345: shows [Kc Kd] (a pair of Kings)
*** FIRST FLOP *** [2c 6d 9h]
*** FIRST TURN *** [2c 6d 9h] [Ts]
*** FIRST RIVER *** [2c 6d 9h Ts] [3c]
*** SECOND FLOP *** [Kh 4s 7d]
*** SECOND TURN *** [Kh 4s 7d] [Qc]
*** SECOND RIVER *** [Kh 4s 7d Qc] [Ks]
*** FIRST SHOWDOWN ***
Hero collected $5.00 from pot
*** SECOND SHOWDOWN ***
abc12345 collected $5.00 from pot
*** SUMMARY ***
Total pot $10.00 | Rake $0 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0
Hand was run two times
FIRST Board [2c 6d 9h Ts 3c]
SECOND Board [Kh 4s 7d Qc Ks]
Seat 1: Hero (small blind) showed [Ah Ac] and won ($5.00) with a pair of Aces, and lost with three of a kind, Kings
Seat 2: abc12345 (big blind) showed [Kc Kd] and lost with a pair of Aces, and won ($5.00) with three of a kind, Kings
`;
}

// Reproduces a real hand pulled from an actual GGPoker export (player IDs
// kept as-is; this specific double-straddle-into-an-all-in spot is what
// surfaced a real parser bug during a corpus smoke test: treating each
// "straddle $X" line as an additive post - like a blind - let a player's
// computed investment exceed their starting stack, because GGPoker's
// straddle lines are actually running-total ("raise to $X") amounts, not
// increments. This fixture is independently verified: every player's
// invested/winnings figures below were hand-derived from the raw text
// and reconcile exactly against the real stack sizes and the real
// "Total pot $187.02 | Rake $5 | Jackpot $1" line (total player
// profitLoss should sum to exactly -$6.00, the rake+jackpot taken out).
function doubleStraddleAllInHand() {
  return `Poker Hand #HD140722363: Hold'em No Limit ($0.5/$1) - 2026/08/22 02:42:06
Table 'NLHSilver12' 6-max Seat #2 is the button
Seat 1: cbd38f96 ($138.69 in chips)
Seat 2: fbb6c1a1 ($136.38 in chips)
Seat 3: b8da175a ($262.7 in chips)
Seat 4: 72e99644 ($93.26 in chips)
Seat 5: 5a024d7f ($212.23 in chips)
Seat 6: 2775b93a ($110.05 in chips)
b8da175a: posts small blind $0.5
72e99644: posts big blind $1
72e99644: straddle $2
72e99644: straddle $4
*** HOLE CARDS ***
Dealt to cbd38f96
Dealt to fbb6c1a1
Dealt to b8da175a
Dealt to 72e99644
Dealt to 5a024d7f
Dealt to 2775b93a
5a024d7f: folds
2775b93a: folds
cbd38f96: raises $4 to $8
fbb6c1a1: folds
b8da175a: folds
72e99644: calls $4
*** FLOP *** [Kd 8h 6c]
72e99644: checks
cbd38f96: bets $5.45
72e99644: calls $5.45
*** TURN *** [Kd 8h 6c] [7h]
72e99644: checks
cbd38f96: bets $24
72e99644: calls $24
*** RIVER *** [Kd 8h 6c 7h] [5c]
72e99644: bets $55.81 and is all-in
cbd38f96: calls $55.81
72e99644: shows [Jd Ks] (a pair of Kings)
cbd38f96: shows [6d 6s] (three of a kind, Sixes)
*** SHOWDOWN ***
cbd38f96 collected $181.02 from pot
*** SUMMARY ***
Total pot $187.02 | Rake $5 | Jackpot $1 | Bingo $0 | Fortune $0 | Tax $0
Board [Kd 8h 6c 7h 5c]
Seat 1: cbd38f96 showed [6d 6s] and won ($181.02) with three of a kind, Sixes
Seat 2: fbb6c1a1 (button) folded before Flop (didn't bet)
Seat 3: b8da175a (small blind) folded before Flop
Seat 4: 72e99644 (big blind) showed [Jd Ks] and lost with a pair of Kings
Seat 5: 5a024d7f folded before Flop (didn't bet)
Seat 6: 2775b93a folded before Flop (didn't bet)
`;
}

// Real GGPoker exports list hands NEWEST-FIRST down the file; this fixture
// deliberately reproduces that (descending timestamps in file order) so the
// parser's post-parse ascending sort can be verified against it.
function threeHandsNewestFirstInFile() {
  const template = (id, time) => `Poker Hand #${id}: Hold'em No Limit ($0.05/$0.1) - 2026/01/01 ${time}
Table 'RegressionTable' 2-max Seat #1 is the button
Seat 1: Hero ($5.00 in chips)
Seat 2: abc12345 ($5.00 in chips)
Hero: posts small blind $0.05
abc12345: posts big blind $0.1
*** HOLE CARDS ***
Dealt to Hero [2c 3d]
Dealt to abc12345
Hero: folds
Uncalled bet ($0.05) returned to abc12345
*** SHOWDOWN ***
abc12345 collected $0.1 from pot
*** SUMMARY ***
Total pot $0.1 | Rake $0
Seat 2: abc12345 (big blind) collected ($0.1)
`;
  const newest = template('HD100103', '12:20:00');
  const middle = template('HD100102', '12:15:00');
  const oldest = template('HD100101', '12:10:00');
  return [newest, middle, oldest].join('\n');
}

function minimalACRHand() {
  return `Hand #999 - Holdem(No Limit) - $1/$2 - 2026/01/01 12:00:00 UTC
Table 'T' 2-max Seat #1 is the button
Seat 1: Hero ($5.00)
Seat 2: Villain ($5.00)
Hero posts the small blind $0.05
Villain posts the big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [7h 7d]
Hero folds
Uncalled bet ($0.05) returned to Villain
*** SUMMARY ***
Total pot $0.10 | Rake $0.00
Seat 1: Hero (button) folded before Flop
Seat 2: Villain (big blind) won $0.10
`;
}

describe('parseGGPokerLog: basic showdown', () => {
  it('parses players, board, and sources winnings from the SUMMARY section (not the pre-summary "collected from pot" line)', () => {
    const [hand] = parseGGPokerLog(heroWinsAtShowdown());
    const hero = hand.players.find(p => p.isHero);
    const villain = hand.players.find(p => !p.isHero);

    expect(hand.gameType).toBe('NLH');
    expect(hand.stakes).toBe('$0.05/$0.1');
    expect(hand.players).toHaveLength(2);
    expect(hero.name).toBe('Hero');
    expect(hero.holeCards).toEqual(['7h', '7d']);
    expect(hand.board).toEqual({
      flop: ['7c', '2h', '3d'],
      turn: ['7c', '2h', '3d', '9s'],
      river: ['7c', '2h', '3d', '9s', '4c'],
    });
    expect(hand.finalPotSize).toBe(60); // "Total pot $0.6"
    expect(hand.winners).toEqual(['Hero']);
    // The pre-summary "*** SHOWDOWN ***" line deliberately says $999.00 -
    // if that leaked into winnings this would be a huge number instead.
    expect(hero.winnings).toBe(57); // SUMMARY "won ($0.57)" only
    expect(hero.profitLoss).toBe(27); // 57 winnings - 30 invested (5 SB + 25 raise-add)
    expect(villain.showedHand).toEqual(['Ah', 'Ad']);
  });
});

describe('parseGGPokerLog: uncalled bet, no showdown', () => {
  it('combines the uncalled-bet return and the SUMMARY collected amount into winnings', () => {
    const [hand] = parseGGPokerLog(heroWinsUncalledNoShowdown());
    const hero = hand.players.find(p => p.isHero);

    expect(hand.winners).toEqual(['Hero']);
    expect(hero.winnings).toBe(110); // 90 (uncalled) + 20 (SUMMARY "collected ($0.2)")
    expect(hero.profitLoss).toBe(10); // 110 winnings - 100 invested (raised to $1.00) = won BB's $0.10
    expect(hand.finalPotSize).toBe(20);
  });
});

describe('parseGGPokerLog: all-in EV wiring', () => {
  it('detects the all-in and computes a correct allInEV', () => {
    const [hand] = parseGGPokerLog(heroAllInFlopShowdown());
    const hero = hand.players.find(p => p.isHero);

    expect(hand.isAllIn).toBe(true);
    expect(hero.profitLoss).toBe(500); // won $10.00 pot, invested $5.00 -> +$5.00 net, in cents

    const [heroEquity] = simulateEquity([['7h', '7d'], ['Kc', 'Kd']], ['7c', '2h', '3d']);
    const expectedEV = heroEquity * 1000 - 500;
    expect(hand.allInEV).toBeCloseTo(expectedEV, 10);
    expect(hand.allInEV).toBeGreaterThan(0);
  });
});

describe('parseGGPokerLog: run it twice', () => {
  it('populates board from the first runout and secondBoard from the second, and sums per-seat multi-run winnings', () => {
    const [hand] = parseGGPokerLog(runItTwiceHand());
    const hero = hand.players.find(p => p.isHero);
    const villain = hand.players.find(p => !p.isHero);

    expect(hand.isRunTwice).toBe(true);
    expect(hand.board).toEqual({
      flop: ['2c', '6d', '9h'],
      turn: ['2c', '6d', '9h', 'Ts'],
      river: ['2c', '6d', '9h', 'Ts', '3c'],
    });
    expect(hand.secondBoard).toEqual({
      flop: ['Kh', '4s', '7d'],
      turn: ['Kh', '4s', '7d', 'Qc'],
      river: ['Kh', '4s', '7d', 'Qc', 'Ks'],
    });
    expect(hand.board.river).not.toEqual(hand.secondBoard.river);

    expect(hand.winners).toEqual(expect.arrayContaining(['Hero', 'abc12345']));
    expect(hero.winnings).toBe(500); // won exactly one of the two runs
    expect(villain.winnings).toBe(500);
    expect(hero.profitLoss).toBe(0); // won one run, lost the other -> breakeven
  });
});

describe('parseGGPokerLog: straddle', () => {
  it('treats each "straddle $X" line as a running preflop total (raise-to), not an additive post', () => {
    const [hand] = parseGGPokerLog(doubleStraddleAllInHand());
    const straddler = hand.players.find(p => p.name === '72e99644');
    const raiser = hand.players.find(p => p.name === 'cbd38f96');

    // The double-straddler's total investment across the whole hand must
    // land exactly on their starting stack (all-in on the river) - it
    // would exceed it if the two straddle lines were summed additively
    // on top of the big blind instead of each being read as a new total.
    expect(straddler.stack).toBe(9326); // "$93.26 in chips"
    expect(straddler.winnings).toBe(0); // lost at showdown
    expect(straddler.profitLoss).toBe(-9326);

    expect(raiser.winnings).toBe(18102); // SUMMARY "won ($181.02)"
    expect(raiser.profitLoss).toBe(8776); // 18102 - 9326 invested

    // Money-conservation invariant: total player profitLoss across the
    // whole hand must equal exactly -(rake + jackpot) = -$5.00 - $1.00.
    const totalProfitLoss = hand.players.reduce((sum, p) => sum + (p.profitLoss || 0), 0);
    expect(totalProfitLoss).toBe(-600);
  });
});

describe('parseGGPokerLog: hand ordering', () => {
  it('reverses GGPoker\'s newest-first file order into chronological order and reassigns handIndex', () => {
    const hands = parseGGPokerLog(threeHandsNewestFirstInFile());

    expect(hands).toHaveLength(3);
    expect(hands[0].datePlayed.getTime()).toBeLessThan(hands[1].datePlayed.getTime());
    expect(hands[1].datePlayed.getTime()).toBeLessThan(hands[2].datePlayed.getTime());
    expect(hands.map(h => h.handIndex)).toEqual([1, 2, 3]);
    expect(hands[0].datePlayed.toISOString()).toContain('12:10:00');
    expect(hands[2].datePlayed.toISOString()).toContain('12:20:00');
  });
});

describe('parsePokerLog dispatcher', () => {
  it('detects a GGPoker export and routes it to parseGGPokerLog', () => {
    const { format, hands } = parsePokerLog(heroWinsAtShowdown());
    expect(format).toBe('GGPOKER');
    expect(hands).toHaveLength(1);
  });

  it('still detects an ACR export as ACR (regression guard against the new branch shadowing it)', () => {
    const { format, hands } = parsePokerLog(minimalACRHand());
    expect(format).toBe('ACR');
    expect(hands).toHaveLength(1);
  });
});
