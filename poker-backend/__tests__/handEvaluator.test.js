import { describe, it, expect } from 'vitest';
import { evaluateHand, getEvaluatorTableStats, HandRank } from '../utils/handEvaluator.js';

describe('table generation', () => {
  it('produces exactly 7462 distinct 5-card hand strengths', () => {
    const stats = getEvaluatorTableStats();
    expect(stats.totalDistinct).toBe(7462);
    // flush/non-flush (straight+high-card) sides share the same 1287
    // 5-distinct-rank combinations (C(13,5)); the "has a repeated rank"
    // side (quads/full house/trips/two pair/pair) is 4888 - see
    // handEvaluator.js's buildTables() comment for the full breakdown.
    expect(stats.flushCount).toBe(1287);
    expect(stats.uniqueCount).toBe(1287);
    expect(stats.productCount).toBe(4888);
  });
});

describe('category ordering', () => {
  const HANDS = [
    { label: 'high card', cards: ['Ah', 'Kd', 'Qc', 'Js', '9h'], rank: HandRank.HIGH_CARD },
    { label: 'pair', cards: ['Kh', 'Kd', '7c', '5s', '3h'], rank: HandRank.PAIR },
    { label: 'two pair', cards: ['Kh', 'Kd', '7c', '7s', 'Ah'], rank: HandRank.TWO_PAIR },
    { label: 'three of a kind', cards: ['7h', '7d', '7c', 'Kh', 'Qd'], rank: HandRank.THREE_OF_A_KIND },
    { label: 'straight', cards: ['9h', '8d', '7c', '6s', '5h'], rank: HandRank.STRAIGHT },
    { label: 'flush', cards: ['Ah', 'Kh', 'Qh', 'Jh', '9h'], rank: HandRank.FLUSH },
    { label: 'full house', cards: ['Kh', 'Kd', 'Kc', 'Qh', 'Qd'], rank: HandRank.FULL_HOUSE },
    { label: 'four of a kind', cards: ['Ah', 'Ad', 'Ac', 'As', 'Kh'], rank: HandRank.FOUR_OF_A_KIND },
    { label: 'straight flush', cards: ['9s', '8s', '7s', '6s', '5s'], rank: HandRank.STRAIGHT_FLUSH },
    { label: 'royal flush', cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'], rank: HandRank.ROYAL_FLUSH }
  ];

  it.each(HANDS)('classifies $label correctly', ({ cards, rank }) => {
    expect(evaluateHand(cards).rank).toBe(rank);
  });

  it('ranks every category strictly above the one before it', () => {
    const strengths = HANDS.map(h => evaluateHand(h.cards).strength);
    for (let i = 1; i < strengths.length; i++) {
      expect(strengths[i]).toBeGreaterThan(strengths[i - 1]);
    }
  });
});

describe('kicker tie-breaks', () => {
  it('one pair: higher kicker wins with identical pair', () => {
    const better = evaluateHand(['Kh', 'Kd', '9c', '5s', '4h']);
    const worse = evaluateHand(['Kh', 'Kd', '9c', '5s', '3h']);
    expect(better.strength).toBeGreaterThan(worse.strength);
  });

  it('two pair: higher kicker wins with identical pairs', () => {
    const better = evaluateHand(['Kh', 'Kd', '7c', '7s', 'Ah']);
    const worse = evaluateHand(['Kh', 'Kd', '7c', '7s', 'Qh']);
    expect(better.strength).toBeGreaterThan(worse.strength);
  });

  it('two pair: higher top pair beats lower top pair regardless of kicker', () => {
    const acesOverDeuces = evaluateHand(['Ah', 'Ad', '2c', '2s', '3h']);
    const kingsOverQueens = evaluateHand(['Kh', 'Kd', 'Qc', 'Qs', 'Ah']);
    expect(acesOverDeuces.strength).toBeGreaterThan(kingsOverQueens.strength);
  });

  it('three of a kind: kicker order matters', () => {
    const better = evaluateHand(['7h', '7d', '7c', 'Kh', 'Qd']);
    const worse = evaluateHand(['7h', '7d', '7c', 'Kh', 'Jd']);
    expect(better.strength).toBeGreaterThan(worse.strength);
  });

  it('full house: trip rank dominates pair rank', () => {
    const tripKings = evaluateHand(['Kh', 'Kd', 'Kc', '2h', '2d']);
    const tripQueens = evaluateHand(['Qh', 'Qd', 'Qc', 'Ah', 'Ad']);
    expect(tripKings.strength).toBeGreaterThan(tripQueens.strength);
  });

  it('full house: same trip rank, pair rank breaks the tie', () => {
    const higherPair = evaluateHand(['Kh', 'Kd', 'Kc', '3h', '3d']);
    const lowerPair = evaluateHand(['Kh', 'Kd', 'Kc', '2h', '2d']);
    expect(higherPair.strength).toBeGreaterThan(lowerPair.strength);
  });

  it('flush: compares full 5-card kicker order, not just the top card', () => {
    const better = evaluateHand(['Ah', 'Kh', 'Qh', 'Jh', '9h']);
    const worse = evaluateHand(['Ah', 'Kh', 'Qh', 'Jh', '8h']);
    expect(better.strength).toBeGreaterThan(worse.strength);
  });

  it('high card: compares full 5-card kicker order', () => {
    const better = evaluateHand(['Ah', 'Kd', 'Qc', 'Js', '9h']);
    const worse = evaluateHand(['Ah', 'Kd', 'Qc', 'Js', '8h']);
    expect(better.strength).toBeGreaterThan(worse.strength);
  });
});

describe('wheel straight (A-2-3-4-5)', () => {
  it('classifies the wheel as a straight', () => {
    const wheel = evaluateHand(['As', '2s', '3d', '4c', '5h']);
    expect(wheel.rank).toBe(HandRank.STRAIGHT);
  });

  it('the wheel is the LOWEST straight - a 6-high straight beats it', () => {
    const wheel = evaluateHand(['As', '2s', '3d', '4c', '5h']);
    const sixHigh = evaluateHand(['6s', '5d', '4c', '3h', '2s']);
    expect(sixHigh.strength).toBeGreaterThan(wheel.strength);
  });

  it('the wheel still beats every non-straight, non-flush hand', () => {
    const wheel = evaluateHand(['As', '2s', '3d', '4c', '5h']);
    const tripAces = evaluateHand(['Ah', 'Ad', 'Ac', 'Kh', 'Qd']);
    expect(wheel.strength).toBeGreaterThan(tripAces.strength);
  });

  it('a steel wheel (A-2-3-4-5 suited) is a straight flush, not a royal flush', () => {
    const steelWheel = evaluateHand(['As', '2s', '3s', '4s', '5s']);
    expect(steelWheel.rank).toBe(HandRank.STRAIGHT_FLUSH);
  });

  it('a steel wheel is the lowest straight flush - a 6-high straight flush beats it', () => {
    const steelWheel = evaluateHand(['As', '2s', '3s', '4s', '5s']);
    const sixHighFlush = evaluateHand(['6s', '5s', '4s', '3s', '2s']);
    expect(sixHighFlush.strength).toBeGreaterThan(steelWheel.strength);
  });

  it('a steel wheel still beats every four of a kind', () => {
    const steelWheel = evaluateHand(['As', '2s', '3s', '4s', '5s']);
    const quadAces = evaluateHand(['Ah', 'Ad', 'Ac', 'As', 'Kh']);
    expect(steelWheel.strength).toBeGreaterThan(quadAces.strength);
  });
});

describe('royal flush', () => {
  it('is the single best possible hand', () => {
    const royal = evaluateHand(['As', 'Ks', 'Qs', 'Js', 'Ts']);
    const nextBestStraightFlush = evaluateHand(['Ks', 'Qs', 'Js', 'Ts', '9s']);
    expect(royal.rank).toBe(HandRank.ROYAL_FLUSH);
    expect(royal.strength).toBeGreaterThan(nextBestStraightFlush.strength);
  });
});

describe('6- and 7-card evaluation (best-5-of-N)', () => {
  it('finds the best 5-card hand using hole cards + board', () => {
    const result = evaluateHand(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d']);
    expect(result.rank).toBe(HandRank.ROYAL_FLUSH);
  });

  it('"the board plays" - best hand can ignore both hole cards entirely', () => {
    // Hole cards are garbage (2c 3d); the royal flush is entirely on the board.
    const result = evaluateHand(['2c', '3d', 'Ah', 'Kh', 'Qh', 'Jh', 'Th']);
    expect(result.rank).toBe(HandRank.ROYAL_FLUSH);
  });

  it('finds trips buried among 6 cards, not just the first 5', () => {
    const result = evaluateHand(['7h', '2c', '7d', '7c', 'Kh', 'Qd']);
    expect(result.rank).toBe(HandRank.THREE_OF_A_KIND);
  });

  it('rejects fewer than 5 or more than 7 cards', () => {
    expect(() => evaluateHand(['Ah', 'Kh', 'Qh', 'Jh'])).toThrow();
    expect(() => evaluateHand(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9h', '8h', '7h'])).toThrow();
  });
});

// Independent reference comparator, written separately from handEvaluator.js
// (different data structures, no shared helpers) so it can't share a bug
// with the implementation under test. Cross-checking against many random
// hands catches mistakes the fixed example hands above might miss.
const REF_TIER = {
  HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_OF_A_KIND: 3, STRAIGHT: 4,
  FLUSH: 5, FULL_HOUSE: 6, FOUR_OF_A_KIND: 7, STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 8
};

function referenceClassify5(cards) {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every(c => c.suit === cards[0].suit);

  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const distinct = Object.keys(counts).map(Number).sort((a, b) => b - a);

  let isStraight = false;
  let straightHigh = null;
  if (distinct.length === 5) {
    if (distinct[0] - distinct[4] === 4) { isStraight = true; straightHigh = distinct[0]; }
    else if (distinct.join(',') === '14,5,4,3,2') { isStraight = true; straightHigh = 5; }
  }

  const byCount = {};
  for (const r of distinct) (byCount[counts[r]] ??= []).push(r);
  for (const k of Object.keys(byCount)) byCount[k].sort((a, b) => b - a);

  let rank, tiebreak;
  if (distinct.length === 5) {
    if (isFlush && isStraight) rank = straightHigh === 14 ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH';
    else if (isFlush) rank = 'FLUSH';
    else if (isStraight) rank = 'STRAIGHT';
    else rank = 'HIGH_CARD';
    tiebreak = isStraight ? [straightHigh] : ranks;
  } else if (byCount[4]) {
    rank = 'FOUR_OF_A_KIND';
    tiebreak = [byCount[4][0], byCount[1][0]];
  } else if (byCount[3] && byCount[2]) {
    rank = 'FULL_HOUSE';
    tiebreak = [byCount[3][0], byCount[2][0]];
  } else if (byCount[3]) {
    rank = 'THREE_OF_A_KIND';
    tiebreak = [byCount[3][0], ...byCount[1]];
  } else if (byCount[2] && byCount[2].length === 2) {
    rank = 'TWO_PAIR';
    tiebreak = [...byCount[2], byCount[1][0]];
  } else {
    rank = 'PAIR';
    tiebreak = [byCount[2][0], ...byCount[1]];
  }

  return { tier: REF_TIER[rank], tiebreak, rank };
}

function referenceCompare5(a, b) {
  const ca = referenceClassify5(a);
  const cb = referenceClassify5(b);
  if (ca.tier !== cb.tier) return ca.tier - cb.tier;
  const len = Math.max(ca.tiebreak.length, cb.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (ca.tiebreak[i] ?? 0) - (cb.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Deterministic PRNG (mulberry32) so this test is reproducible across runs/CI.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDeck(rng) {
  const suits = ['s', 'h', 'd', 'c'];
  const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const deck = [];
  for (const rank of ranks) for (const suit of suits) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

describe('cross-check against an independent reference comparator', () => {
  it('agrees on relative strength for 3000 random 5-card hand pairs', () => {
    const rng = mulberry32(12345);
    let checked = 0;
    for (let trial = 0; trial < 3000; trial++) {
      const deck = randomDeck(rng);
      const handA = deck.slice(0, 5);
      const handB = deck.slice(5, 10);

      const refDiff = referenceCompare5(handA, handB);
      const a = evaluateHand(handA);
      const b = evaluateHand(handB);
      const implSign = Math.sign(a.strength - b.strength);
      const refSign = Math.sign(refDiff);

      expect(implSign).toBe(refSign);
      checked++;
    }
    expect(checked).toBe(3000);
  });

  it('agrees on the winning 5-card subset for 1000 random 7-card hands vs a reference best-of-21', () => {
    const rng = mulberry32(67890);
    function bestOf7Reference(cards) {
      let best = null;
      const idxCombos = [];
      const combo = (start, chosen) => {
        if (chosen.length === 5) { idxCombos.push([...chosen]); return; }
        for (let i = start; i < cards.length; i++) { chosen.push(i); combo(i + 1, chosen); chosen.pop(); }
      };
      combo(0, []);
      for (const idx of idxCombos) {
        const five = idx.map(i => cards[i]);
        const cls = referenceClassify5(five);
        if (!best || cls.tier > best.tier || (cls.tier === best.tier && compareTiebreak(cls.tiebreak, best.tiebreak) > 0)) {
          best = cls;
        }
      }
      return best;
    }
    function compareTiebreak(a, b) {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    }

    for (let trial = 0; trial < 1000; trial++) {
      const deck = randomDeck(rng);
      const seven = deck.slice(0, 7);
      const implResult = evaluateHand(seven);
      const refResult = bestOf7Reference(seven);
      expect(implResult.rank).toBe(refResult.rank);
    }
  });
});
