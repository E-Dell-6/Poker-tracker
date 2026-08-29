import { parseCard } from './cardParser.js';
import { combinations, combinationsOf } from './combinatorics.js';

// Standard Texas Hold'em hand ranking, low to high.
export const HandRank = {
  HIGH_CARD: 'HIGH_CARD',
  PAIR: 'PAIR',
  TWO_PAIR: 'TWO_PAIR',
  THREE_OF_A_KIND: 'THREE_OF_A_KIND',
  STRAIGHT: 'STRAIGHT',
  FLUSH: 'FLUSH',
  FULL_HOUSE: 'FULL_HOUSE',
  FOUR_OF_A_KIND: 'FOUR_OF_A_KIND',
  STRAIGHT_FLUSH: 'STRAIGHT_FLUSH',
  ROYAL_FLUSH: 'ROYAL_FLUSH' // a STRAIGHT_FLUSH with an Ace high - same tier, always the top of it
};

// ROYAL_FLUSH shares a tier with STRAIGHT_FLUSH (its tiebreak - high card
// Ace - always sorts it above every other straight flush within that tier).
const CATEGORY_TIER = {
  [HandRank.HIGH_CARD]: 0,
  [HandRank.PAIR]: 1,
  [HandRank.TWO_PAIR]: 2,
  [HandRank.THREE_OF_A_KIND]: 3,
  [HandRank.STRAIGHT]: 4,
  [HandRank.FLUSH]: 5,
  [HandRank.FULL_HOUSE]: 6,
  [HandRank.FOUR_OF_A_KIND]: 7,
  [HandRank.STRAIGHT_FLUSH]: 8,
  [HandRank.ROYAL_FLUSH]: 8
};

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
// One prime per rank (2..14). Encoding a 5-card hand's ranks as a product
// of these primes gives a value that uniquely identifies its rank-shape
// (which ranks appear, with what multiplicity) - prime factorization is
// unique, so two different rank-shapes can never produce the same
// product. This is the classic Cactus Kev trick, used here only for the
// "has a repeated rank" (pair/trips/full house/quads) case.
const PRIMES = { 2: 2, 3: 3, 4: 5, 5: 7, 6: 11, 7: 13, 8: 17, 9: 19, 10: 23, 11: 29, 12: 31, 13: 37, 14: 41 };

function bitpattern(ranks) {
  let bp = 0;
  for (const r of ranks) bp |= 1 << (r - 2);
  return bp;
}

// `desc` is 5 distinct ranks, sorted descending. Straights only need their
// high card to compare - two straights with the same high card are always
// tied in hold'em, regardless of the other cards - except the wheel
// (A-2-3-4-5), which is the one straight where the Ace counts low and the
// straight's "high card" for comparison purposes is the 5, not the Ace.
function straightInfo(desc) {
  if (desc[0] - desc[4] === 4) return { isStraight: true, high: desc[0] };
  if (desc[0] === 14 && desc[1] === 5 && desc[2] === 4 && desc[3] === 3 && desc[4] === 2) {
    return { isStraight: true, high: 5 };
  }
  return { isStraight: false, high: null };
}

function compareClassification(a, b) {
  const tierDiff = CATEGORY_TIER[a.category] - CATEGORY_TIER[b.category];
  if (tierDiff !== 0) return tierDiff;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Builds the full 7462-entry strength ordering for every distinct 5-card
// hand shape, generated from rank-combinatorics rather than enumerating
// all C(52,5) actual card combinations - each of the 6 shapes below
// (5-distinct-ranks x{flush,non-flush}, quads, full house, trips, two
// pair, one pair) is enumerated directly from its own rank arithmetic, so
// the whole table is ~7462 iterations, not 2.6 million, while still being
// exhaustive: every shape that requires at most 4 of a given rank (the
// real deck's limit) is covered exactly once, verified by the "produces
// exactly 7462 distinct strengths" test.
//
// Split into three lookup tables (mirrors the classic Cactus-Kev
// structure): flushLookup/uniqueLookup are keyed by a 13-bit rank-presence
// bitpattern (only ever populated for hands with 5 distinct ranks - a
// flush can never contain a repeated rank, since a suit has one card per
// rank), productLookup is keyed by the prime product for anything with a
// repeated rank.
function buildTables() {
  const classifications = [];

  for (const combo of combinationsOf(RANKS, 5)) {
    const desc = [...combo].sort((a, b) => b - a);
    const bp = bitpattern(desc);
    const { isStraight, high } = straightInfo(desc);

    const flushCategory = isStraight ? (high === 14 ? HandRank.ROYAL_FLUSH : HandRank.STRAIGHT_FLUSH) : HandRank.FLUSH;
    classifications.push({ key: `F:${bp}`, category: flushCategory, tiebreak: isStraight ? [high] : desc });

    const nonFlushCategory = isStraight ? HandRank.STRAIGHT : HandRank.HIGH_CARD;
    classifications.push({ key: `U:${bp}`, category: nonFlushCategory, tiebreak: isStraight ? [high] : desc });
  }

  for (const quadRank of RANKS) {
    for (const kicker of RANKS) {
      if (kicker === quadRank) continue;
      const pp = PRIMES[quadRank] ** 4 * PRIMES[kicker];
      classifications.push({ key: `P:${pp}`, category: HandRank.FOUR_OF_A_KIND, tiebreak: [quadRank, kicker] });
    }
  }

  for (const tripRank of RANKS) {
    for (const pairRank of RANKS) {
      if (pairRank === tripRank) continue;
      const pp = PRIMES[tripRank] ** 3 * PRIMES[pairRank] ** 2;
      classifications.push({ key: `P:${pp}`, category: HandRank.FULL_HOUSE, tiebreak: [tripRank, pairRank] });
    }
  }

  for (const tripRank of RANKS) {
    const remaining = RANKS.filter(r => r !== tripRank);
    for (const kickers of combinationsOf(remaining, 2)) {
      const [k1, k2] = [...kickers].sort((a, b) => b - a);
      const pp = PRIMES[tripRank] ** 3 * PRIMES[k1] * PRIMES[k2];
      classifications.push({ key: `P:${pp}`, category: HandRank.THREE_OF_A_KIND, tiebreak: [tripRank, k1, k2] });
    }
  }

  for (const pairRanks of combinationsOf(RANKS, 2)) {
    const [p1, p2] = [...pairRanks].sort((a, b) => b - a);
    const remaining = RANKS.filter(r => r !== p1 && r !== p2);
    for (const kicker of remaining) {
      const pp = PRIMES[p1] ** 2 * PRIMES[p2] ** 2 * PRIMES[kicker];
      classifications.push({ key: `P:${pp}`, category: HandRank.TWO_PAIR, tiebreak: [p1, p2, kicker] });
    }
  }

  for (const pairRank of RANKS) {
    const remaining = RANKS.filter(r => r !== pairRank);
    for (const kickers of combinationsOf(remaining, 3)) {
      const [k1, k2, k3] = [...kickers].sort((a, b) => b - a);
      const pp = PRIMES[pairRank] ** 2 * PRIMES[k1] * PRIMES[k2] * PRIMES[k3];
      classifications.push({ key: `P:${pp}`, category: HandRank.PAIR, tiebreak: [pairRank, k1, k2, k3] });
    }
  }

  // Every key above is derived from a unique rank-shape by construction
  // (unique prime factorization per shape+ranks for 'P:', a bijective
  // bitpattern per 5-rank subset for 'F:'/'U:'), so this Map should never
  // actually collapse two different classifications onto one key - going
  // through a Map anyway makes that assumption verifiable rather than
  // assumed (a collision would silently drop an entry, and the exactly-
  // 7462 test below would catch it).
  const byKey = new Map();
  for (const c of classifications) byKey.set(c.key, c);

  const sorted = [...byKey.values()].sort(compareClassification);
  sorted.forEach((c, i) => { c.strength = i + 1; }); // 1 = worst (7-high), 7462 = best (royal flush)

  const flushLookup = new Map();
  const uniqueLookup = new Map();
  const productLookup = new Map();

  for (const c of sorted) {
    const prefix = c.key[0];
    const rest = Number(c.key.slice(2));
    const entry = { strength: c.strength, category: c.category };
    if (prefix === 'F') flushLookup.set(rest, entry);
    else if (prefix === 'U') uniqueLookup.set(rest, entry);
    else productLookup.set(rest, entry);
  }

  return { flushLookup, uniqueLookup, productLookup, totalDistinct: sorted.length };
}

// Lazy singleton: built on first use, not at module load, so importing
// this file elsewhere doesn't pay the (small but non-zero) generation
// cost unless a caller actually evaluates a hand.
let tables = null;
function getTables() {
  if (!tables) tables = buildTables();
  return tables;
}

// Diagnostic accessor for tests - not used by evaluateHand itself.
export function getEvaluatorTableStats() {
  const t = getTables();
  return { totalDistinct: t.totalDistinct, flushCount: t.flushLookup.size, uniqueCount: t.uniqueLookup.size, productCount: t.productLookup.size };
}

function lookupFive(cards) {
  const { flushLookup, uniqueLookup, productLookup } = getTables();
  const isFlush = cards.every(c => c.suit === cards[0].suit);
  const distinctRanks = [...new Set(cards.map(c => c.rank))];

  if (isFlush) return flushLookup.get(bitpattern(distinctRanks));
  if (distinctRanks.length === 5) return uniqueLookup.get(bitpattern(distinctRanks));

  const pp = cards.reduce((p, c) => p * PRIMES[c.rank], 1);
  return productLookup.get(pp);
}

// `cards` is 5-7 cards (2 hole + up to 5 board), as parsed {rank,suit}
// objects or raw "Ah"-style strings (parsed via cardParser.js). For 6/7
// cards, evaluates every 5-card subset (C(6,5)=6 or C(7,5)=21) via the
// O(1) lookup tables above and keeps the best - fast enough to call
// thousands of times per equity simulation, no brute-force comparator.
export function evaluateHand(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateHand expects 5-7 cards, got ${cards?.length ?? 0}`);
  }
  const parsed = cards.map(c => (typeof c === 'string' ? parseCard(c) : c));

  let best = null;
  for (const idx of combinations(parsed.length, 5)) {
    const five = idx.map(i => parsed[i]);
    const result = lookupFive(five);
    if (!best || result.strength > best.strength) best = result;
  }
  return { rank: best.category, strength: best.strength };
}
