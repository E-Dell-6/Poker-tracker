import { parseCard } from './cardParser.js';
import { evaluateHand } from './handEvaluator.js';
import { combinationsOf } from './combinatorics.js';

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SUITS = ['s', 'h', 'd', 'c'];

function fullDeck() {
  const deck = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit });
  return deck;
}

function cardKey(c) {
  return `${c.rank}${c.suit}`;
}

function toCards(list) {
  return (list || []).map(c => (typeof c === 'string' ? parseCard(c) : c));
}

// Above this many unknown board cards, exhaustive enumeration is Monte
// Carlo's job instead - see the equity-method discussion this was built
// from: flop (2 unknown, ~1000 runouts) and turn (1 unknown, ~44 runouts)
// are both cheap enough to enumerate exactly and get a zero-variance exact
// answer; preflop (5 unknown, up to ~1.7M runouts) would cost several
// seconds of blocking CPU time to enumerate exactly in JS, which risks
// stalling the single-threaded Node process for other requests during a
// session upload with several preflop all-ins - Monte Carlo is the
// deliberate choice there, not a fallback for a case nobody thought about.
const EXACT_ENUMERATION_MAX_UNKNOWN = 2;

// Partial Fisher-Yates: draws `count` cards without replacement from
// `deck` using `rng` (defaults to Math.random, injectable for
// deterministic tests). O(count), not O(deck.length), since only the
// first `count` positions of the shuffle are ever needed.
function drawWithoutReplacement(deck, count, rng) {
  const pool = deck.slice();
  const drawn = [];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    drawn.push(pool[i]);
  }
  return drawn;
}

// Returns the index (or indices, on a tie) of the winning hand(s) among
// `strengths`.
function winners(strengths) {
  const max = Math.max(...strengths);
  const idxs = [];
  for (let i = 0; i < strengths.length; i++) if (strengths[i] === max) idxs.push(i);
  return idxs;
}

// `hands`: array of hole-card hands (each an array of 2 card strings/
// objects). `board`: known board cards so far (0, 3, 4, or 5 cards).
// Returns one equity value per hand in `hands`, summing to 1 across all
// hands (ties split equity evenly among the tied winners of each runout).
//
// Only needs exact hole cards - this is the primitive item 4d (all-in EV)
// calls directly for known-showdown-cards spots. Range-weighted equity for
// non-all-in spots (where an opponent's exact cards aren't known) is a
// meaningfully different, harder problem - out of scope here, left as a
// follow-up rather than approximated.
export function simulateEquity(hands, board, trials = 5000) {
  return simulateEquityWithRng(hands, board, trials, Math.random);
}

// Internal entry point with an injectable RNG, so tests can get
// deterministic Monte Carlo runs without touching the public signature.
export function simulateEquityWithRng(hands, board, trials, rng) {
  if (!Array.isArray(hands) || hands.length < 2) {
    throw new Error('simulateEquity needs at least 2 hands');
  }

  const parsedHands = hands.map(toCards);
  const parsedBoard = toCards(board);
  if (parsedBoard.length > 5) {
    throw new Error(`Board has more than 5 cards (${parsedBoard.length})`);
  }

  const known = new Set([...parsedHands.flat(), ...parsedBoard].map(cardKey));
  const deck = fullDeck().filter(c => !known.has(cardKey(c)));

  const unknownCount = 5 - parsedBoard.length;
  const wins = new Array(parsedHands.length).fill(0);
  let totalTrials = 0;

  function scoreRunout(drawnCards) {
    const strengths = parsedHands.map(hole => evaluateHand([...hole, ...parsedBoard, ...drawnCards]).strength);
    const winnerIdxs = winners(strengths);
    const share = 1 / winnerIdxs.length;
    for (const i of winnerIdxs) wins[i] += share;
    totalTrials++;
  }

  if (unknownCount === 0) {
    scoreRunout([]);
  } else if (unknownCount <= EXACT_ENUMERATION_MAX_UNKNOWN) {
    for (const drawnCards of combinationsOf(deck, unknownCount)) scoreRunout(drawnCards);
  } else {
    for (let t = 0; t < trials; t++) scoreRunout(drawWithoutReplacement(deck, unknownCount, rng));
  }

  return wins.map(w => w / totalTrials);
}
