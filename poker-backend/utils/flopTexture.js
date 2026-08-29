// Classifies a flop's texture for slicing postflop stats (cbet, fold-to-
// cbet, check-raise) by how dangerous/coordinated the board is - a c-bet
// on a dry rainbow flop and a c-bet on a monotone connected flop represent
// very different things, even though they're both "a c-bet".

const RANK_NAMES = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' };
function rankName(rank) {
  return RANK_NAMES[rank] ?? String(rank);
}

// Wetness heuristic (deliberately explicit/auditable, not a black box):
//
//   - 'wet':      monotone (all 3 same suit - one card away from a flush)
//                 OR (two-tone AND rank-connected)
//   - 'dry':      rainbow AND NOT rank-connected AND NOT paired
//   - 'semi-wet': everything else - rainbow-but-connected, two-tone-but-
//                 disconnected, or any paired board not already 'wet'
//                 (trips/boat possibilities keep a paired board from
//                 reading as truly dry even when it's rainbow/disconnected)
//
// "Connected" = the flop's distinct ranks fit inside a 5-rank window
// (spread = highest - lowest <= 4), i.e. some straight draw is live.
// Threshold is a named constant so it's tunable without re-deriving it.
const CONNECTED_MAX_SPREAD = 4;

export function classifyFlopTexture(flop) {
  if (!flop || flop.length !== 3) {
    throw new Error(`classifyFlopTexture expects exactly 3 cards, got ${flop?.length ?? 0}`);
  }

  const suits = flop.map(c => c.suit);
  const suitCounts = suits.reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {});
  const distinctSuits = Object.keys(suitCounts).length;
  const monotone = distinctSuits === 1;
  const rainbow = distinctSuits === 3;
  const twoTone = distinctSuits === 2;

  const ranks = flop.map(c => c.rank);
  const distinctRanks = [...new Set(ranks)].sort((a, b) => a - b);
  const paired = distinctRanks.length < 3;

  const spread = distinctRanks[distinctRanks.length - 1] - distinctRanks[0];
  const connected = spread <= CONNECTED_MAX_SPREAD;

  const wet = monotone || (twoTone && connected);
  const dry = rainbow && !connected && !paired;
  const wetness = wet ? 'wet' : dry ? 'dry' : 'semi-wet';

  const highCard = Math.max(...ranks);

  return { wetness, paired, monotone, twoTone, rainbow, connected, highCard, highCardName: rankName(highCard) };
}
