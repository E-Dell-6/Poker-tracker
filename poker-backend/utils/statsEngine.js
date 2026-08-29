// Generalized (non-heads-up-only) player stats engine.
// Takes an array of Hand documents + a matcher function that picks the
// target player's entry out of hand.players, and returns one stats object.
// Used both for opponents (match by personId) and hero (match by isHero).

import { parseBigBlind, CENTS_CURRENCIES } from './blinds.js';
import { getStackDepthBucket } from './stackDepth.js';
import { parseBoard } from './cardParser.js';
import { classifyFlopTexture } from './flopTexture.js';
import { getConfidence, getConfidenceForStat, CONFIDENCE_PROFILES } from './confidence.js';

const STEAL_POSITIONS = ['CO', 'BTN', 'SB'];
const BLIND_POSITIONS = ['SB', 'BB'];

const POSITIONS_BY_SIZE = {
  2: ['BTN/SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO']
};

// Position labels are assigned by seat offset from the button among
// non-sitting-out players. Approximate for weird seat gaps, but correct
// for the standard case of a full/short-handed ring with one dealer flag.
export function getPositionMap(hand) {
  const active = (hand.players || [])
    .filter(p => !p.isSittingOut)
    .slice()
    .sort((a, b) => a.seat - b.seat);

  const n = active.length;
  const map = {};
  if (n < 2) return map;

  const dealerIdx = active.findIndex(p => p.isDealer);
  if (dealerIdx === -1) return map;

  const labels = POSITIONS_BY_SIZE[n] || POSITIONS_BY_SIZE[9];
  for (let i = 0; i < n; i++) {
    const player = active[(dealerIdx + i) % n];
    map[player.name] = labels[i] ?? null;
  }
  return map;
}

function newRateStat() {
  return { made: 0, opportunities: 0 };
}

// "faced/folded/called/raised" is the shared primitive for every
// position-vs-position matchup (facing an open, facing a 3-bet, etc).
// It's deliberately generic rather than a pile of named counters, since
// the same shape answers "defend %", "3-bet %" and "fold %" for whichever
// two positions are involved.
function newVsStat() {
  return { faced: 0, folded: 0, called: 0, raised: 0 };
}

function newPositionStats() {
  return {
    vpip: newRateStat(),
    pfr: newRateStat(),
    open: newRateStat(),
    steal: newRateStat(),
    threeBet: newRateStat(),
    foldTo3Bet: newRateStat(),
    fourBet: newRateStat(),
    foldTo4Bet: newRateStat(),
    cbFlop: newRateStat(),
    foldToCbFlop: newRateStat(),
    wtsd: newRateStat(),
    wwsf: newRateStat()
  };
}

// The full rate-stat set, used by every "group by X" bucket (byStakes,
// byStackDepth, byStakesAndStackDepth). Unlike newPositionStats() above
// (a curated subset), group buckets track everything the top-level
// accumulator does, since there's no a priori reason to leave a stat out
// of an arbitrary stakes/stack-depth slice the way there is for the
// position-matrix UI.
function newGroupStats() {
  return {
    hands: 0,
    vpip: newRateStat(),
    pfr: newRateStat(),
    open: newRateStat(),
    threeBet: newRateStat(),
    foldTo3Bet: newRateStat(),
    fourBet: newRateStat(),
    foldTo4Bet: newRateStat(),
    steal: newRateStat(),
    foldToSteal: newRateStat(),
    limp: newRateStat(),
    coldCall: newRateStat(),
    cbFlop: newRateStat(),
    foldToCbFlop: newRateStat(),
    checkRaise: newRateStat(),
    wtsd: newRateStat(),
    wsd: newRateStat(),
    wwsf: newRateStat(),
    // Per-hand profit/loss, tracked the same way the top-level accumulator
    // does (see the profitLoss block in computeStatsForHands and
    // finalizeProfitLoss below) - a stack-depth or stakes slice without a
    // profitability figure attached is much less useful: "I 3-bet more
    // short-stacked" doesn't tell you whether that's actually winning.
    totalProfitLoss: 0,
    handsWithProfitData: 0,
    bbUnitsWon: 0,
    handsWithBbData: 0,
    currencies: new Set()
  };
}

// Flop-texture bucket ('dry'|'semi-wet'|'wet' - see flopTexture.js): only
// the flop-street stats that actually depend on board texture, not the
// full rate-stat set newGroupStats() tracks for stakes/stack-depth.
function newTextureStats() {
  return {
    hands: 0,
    cbFlop: newRateStat(),
    foldToCbFlop: newRateStat(),
    checkRaise: newRateStat()
  };
}

// acc.positional is keyed by table size (number of active players in the
// hand, matching POSITIONS_BY_SIZE) so 6-handed and 9-handed tendencies -
// which differ structurally, not just by sample size - are never blended
// into one number.
function ensurePositional(acc, tableSize) {
  if (!acc.positional[tableSize]) {
    acc.positional[tableSize] = { positions: {}, vsOpen: {}, vs3Bet: {} };
  }
  return acc.positional[tableSize];
}

function ensurePositionStats(bucket, position) {
  if (!position) return null;
  if (!bucket.positions[position]) {
    bucket.positions[position] = newPositionStats();
  }
  return bucket.positions[position];
}

// Generic lazy-bucket lookup, generalizing ensurePositional above to an
// arbitrary grouping dimension: `container` is a plain object keyed by
// whatever `key` resolves to for this hand (a stakes string, a stack-depth
// bucket, a combined key, ...). Returns null (and creates nothing) when key
// is null/undefined, e.g. a hand with no stakes recorded.
function ensureGroup(container, key, factory) {
  if (key == null) return null;
  if (!container[key]) container[key] = factory();
  return container[key];
}

// vsOpen[attackerPos][responderPos]: responder's fold/call/raise rate when
// facing an open from attackerPos. Covers "BB defend vs BTN", "SB 3-bet vs
// CO open", "fold to steal" broken out by exact attacker, etc.
function ensureVsOpen(bucket, attackerPos, responderPos) {
  if (!attackerPos || !responderPos) return null;
  if (!bucket.vsOpen[attackerPos]) bucket.vsOpen[attackerPos] = {};
  if (!bucket.vsOpen[attackerPos][responderPos]) bucket.vsOpen[attackerPos][responderPos] = newVsStat();
  return bucket.vsOpen[attackerPos][responderPos];
}

// vs3Bet[threeBetterPos][openerPos]: opener's fold/call(4bet)/raise rate
// when facing a 3-bet from threeBetterPos. Covers "BTN's fold to a blind
// 3-bet", "CO 4-bets vs SB 3-bet", etc.
function ensureVs3Bet(bucket, threeBetterPos, openerPos) {
  if (!threeBetterPos || !openerPos) return null;
  if (!bucket.vs3Bet[threeBetterPos]) bucket.vs3Bet[threeBetterPos] = {};
  if (!bucket.vs3Bet[threeBetterPos][openerPos]) bucket.vs3Bet[threeBetterPos][openerPos] = newVsStat();
  return bucket.vs3Bet[threeBetterPos][openerPos];
}

// Mirrors an increment into every sink that actually has that stat (a sink
// may be null - no resolvable position/group for this hand - or may use a
// trimmed shape like newPositionStats() that doesn't track every stat, e.g.
// posStats has no `.limp`). This is the "key-selector, not hardcoded
// per-dimension duplication" mechanism every grouping dimension shares:
// callers just extend the `sinks` array with whatever buckets apply to
// this hand instead of hand-rolling `if (posStats) posStats.X++` per stat.
function bump(sinks, statKey, field) {
  for (const sink of sinks) {
    if (sink && sink[statKey]) sink[statKey][field]++;
  }
}

// Mirrors a single hand's profit/loss (and bb-denominated result) into any
// sink that tracks it - the top-level accumulator and every grouping
// bucket (byStakes/byStackDepth/byStakesAndStackDepth) share this exact
// logic, so a stakes or stack-depth slice's profitability can never drift
// from how the headline totalProfitLoss/bb100 figures are computed.
function bumpProfit(sink, hand, player) {
  if (hand.currency) sink.currencies.add(hand.currency);
  if (typeof player.profitLoss !== 'number') return;

  // player.profitLoss is stored in integer CENTS for USD/CAD hands (see
  // CENTS_CURRENCIES above) but in major units for everything else.
  // totalProfitLoss is a user-facing dollar figure, so it has to be
  // normalized to major units per-hand before summing - otherwise a
  // session's worth of hands in cents dwarfs everything else by ~100x.
  // bbUnitsWon below intentionally keeps using the raw, unconverted
  // profitLoss: parseBigBlind() already scales `bb` up by the same
  // factor for cents currencies, so that ratio was correct as-is and
  // must NOT also be divided here, or it'd be wrong the other way.
  const displayProfit = CENTS_CURRENCIES.has(hand.currency) ? player.profitLoss / 100 : player.profitLoss;
  sink.totalProfitLoss += displayProfit;
  sink.handsWithProfitData++;

  const bb = parseBigBlind(hand.stakes, hand.currency);
  if (bb) {
    sink.bbUnitsWon += player.profitLoss / bb;
    sink.handsWithBbData++;
  }
}

function newAccumulator() {
  return {
    hands: 0,
    vpip: newRateStat(),
    pfr: newRateStat(),
    open: newRateStat(),
    threeBet: newRateStat(),
    foldTo3Bet: newRateStat(),
    fourBet: newRateStat(),
    foldTo4Bet: newRateStat(),
    steal: newRateStat(),
    foldToSteal: newRateStat(),
    limp: newRateStat(),
    coldCall: newRateStat(),
    cbFlop: newRateStat(),
    foldToCbFlop: newRateStat(),
    checkRaise: newRateStat(),
    wtsd: newRateStat(),
    wsd: newRateStat(),
    wwsf: newRateStat(),
    aggBets: 0,
    aggCalls: 0,
    totalProfitLoss: 0,
    handsWithProfitData: 0,
    bbUnitsWon: 0,
    handsWithBbData: 0,
    currencies: new Set(),
    // tableSize -> { positions, vsOpen, vs3Bet } - see ensurePositional above.
    positional: {},
    // stakes string -> newGroupStats(); effective-stack bucket ('short'|
    // 'mid'|'deep') -> newGroupStats(); `${stakes}__${bucket}` -> newGroupStats().
    // See ensureGroup() above - lazily created per hand, same pattern as
    // `positional` generalized to whatever key each dimension resolves to.
    byStakes: {},
    byStackDepth: {},
    byStakesAndStackDepth: {},
    // 'dry'|'semi-wet'|'wet' -> newTextureStats() - see flopTexture.js.
    byFlopTexture: {},
    // Diagnostic: how many of this player's hands actually resolved to a
    // position (needs a dealer/button flag + >=2 active players). If this
    // stays near 0 while totalHands is high, positional stats will look
    // empty even with plenty of data - see positionCoverage in finalize().
    handsWithPosition: 0
  };
}

// posBucket = acc.positional[tableSize] (or null if position unknown) -
// needed here (not just posStats) because vsOpen/vs3Bet are keyed by the
// *attacker's* position, not the target player's own position.
// posStats = posBucket.positions[position] (or null) - the target
// player's own per-position stat line.
// groupBuckets = extra newGroupStats() sinks for this hand (byStakes,
// byStackDepth, byStakesAndStackDepth), already filtered to non-null.
function accumulatePreflop(hand, positionMap, name, acc, posBucket, posStats, groupBuckets) {
  const sinks = [acc, posStats, ...groupBuckets];
  const real = (hand.actions || []).filter(
    a => a.street === 'PREFLOP' && a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB'
  );
  const position = positionMap[name];

  let level = 0; // number of preflop raises seen so far
  const raiserPositionAtLevel = {};
  let onlyPassiveSoFar = true; // no calls/raises yet (only folds) -> steal is live
  let playerHasVpipd = false;
  let playerHasRaised = false;
  const facedAtLevel = new Set(); // avoid double-counting a player acting twice at the same level

  for (const a of real) {
    if (a.player === name) {
      const key = level;
      if (!facedAtLevel.has(key)) {
        facedAtLevel.add(key);

        if (level === 0) {
          bump(sinks, 'open', 'opportunities');
          if (a.actionType === 'RAISE' || a.actionType === 'BET') {
            bump(sinks, 'open', 'made');
            if (onlyPassiveSoFar && STEAL_POSITIONS.includes(position)) {
              bump(sinks, 'steal', 'opportunities');
              bump(sinks, 'steal', 'made');
            }
          } else if (a.actionType === 'CALL') {
            bump(sinks, 'limp', 'opportunities');
            bump(sinks, 'limp', 'made');
          }
        } else if (level === 1) {
          // This is the "facing an open" moment: raiserPositionAtLevel[1]
          // is whoever made it 2 bets to go.
          const openerPos = raiserPositionAtLevel[1];
          const openWasSteal = STEAL_POSITIONS.includes(openerPos);
          bump(sinks, 'threeBet', 'opportunities');
          if (openWasSteal && BLIND_POSITIONS.includes(position)) bump(sinks, 'foldToSteal', 'opportunities');

          if (a.actionType === 'RAISE') {
            bump(sinks, 'threeBet', 'made');
          } else if (a.actionType === 'FOLD') {
            if (openWasSteal && BLIND_POSITIONS.includes(position)) bump(sinks, 'foldToSteal', 'made');
          } else if (a.actionType === 'CALL' && !playerHasVpipd) {
            bump(sinks, 'coldCall', 'opportunities');
            bump(sinks, 'coldCall', 'made');
          }

          if (posBucket && openerPos && position) {
            const vs = ensureVsOpen(posBucket, openerPos, position);
            vs.faced++;
            if (a.actionType === 'FOLD') vs.folded++;
            else if (a.actionType === 'CALL') vs.called++;
            else if (a.actionType === 'RAISE') vs.raised++;
          }
        } else if (level === 2) {
          // Facing a 3-bet: raiserPositionAtLevel[2] is the 3-bettor.
          bump(sinks, 'fourBet', 'opportunities');
          bump(sinks, 'foldTo3Bet', 'opportunities');
          if (a.actionType === 'RAISE') {
            bump(sinks, 'fourBet', 'made');
          } else if (a.actionType === 'FOLD') {
            bump(sinks, 'foldTo3Bet', 'made');
          } else if (a.actionType === 'CALL' && !playerHasVpipd) {
            bump(sinks, 'coldCall', 'opportunities');
            bump(sinks, 'coldCall', 'made');
          }

          const threeBetterPos = raiserPositionAtLevel[2];
          if (posBucket && threeBetterPos && position) {
            const vs = ensureVs3Bet(posBucket, threeBetterPos, position);
            vs.faced++;
            if (a.actionType === 'FOLD') vs.folded++;
            else if (a.actionType === 'CALL') vs.called++;
            else if (a.actionType === 'RAISE') vs.raised++;
          }
        } else if (level === 3) {
          bump(sinks, 'foldTo4Bet', 'opportunities');
          if (a.actionType === 'FOLD') {
            bump(sinks, 'foldTo4Bet', 'made');
          }
        }
      }

      if (a.actionType === 'CALL' || a.actionType === 'RAISE' || a.actionType === 'BET') {
        playerHasVpipd = true;
      }
      if (a.actionType === 'RAISE' || a.actionType === 'BET') playerHasRaised = true;
    }

    if (a.actionType === 'RAISE' || a.actionType === 'BET') {
      level++;
      raiserPositionAtLevel[level] = positionMap[a.player];
      onlyPassiveSoFar = false;
    } else if (a.actionType === 'CALL') {
      onlyPassiveSoFar = false;
    }
  }

  bump(sinks, 'vpip', 'opportunities');
  if (playerHasVpipd) bump(sinks, 'vpip', 'made');
  bump(sinks, 'pfr', 'opportunities');
  if (playerHasRaised) bump(sinks, 'pfr', 'made');

  return { sawFlop: !real.some(a => a.player === name && a.actionType === 'FOLD') };
}

// textureBucket = a { cbFlop, foldToCbFlop, checkRaise } bucket for this
// hand's flop wetness (or null) - only ever touched for flop-street action,
// since texture is a flop-only concept. Kept separate from groupBuckets
// (which apply across every street) rather than folded into `sinks`,
// since it only has 3 of newGroupStats()'s fields.
function accumulatePostflop(hand, name, wasPreflopAggressor, acc, posStats, groupBuckets, textureBucket) {
  const sinks = [acc, posStats, ...groupBuckets];
  const streets = ['FLOP', 'TURN', 'RIVER'];
  let cbTracked = false; // only count cbFlop/foldToCbFlop opportunity once
  let stillIn = true;

  for (const street of streets) {
    const streetActions = (hand.actions || []).filter(a => a.street === street);
    if (streetActions.length === 0) continue;

    const isFlop = street === 'FLOP';
    let hasCheckedThisStreet = false;

    for (let i = 0; i < streetActions.length; i++) {
      const a = streetActions[i];
      const isPlayer = a.player === name;

      if (isFlop && !cbTracked && wasPreflopAggressor) {
        cbTracked = true;
        bump(sinks, 'cbFlop', 'opportunities');
        if (textureBucket) textureBucket.cbFlop.opportunities++;
        const firstAction = streetActions[0];
        if (firstAction.player === name && (firstAction.actionType === 'BET' || firstAction.actionType === 'RAISE')) {
          bump(sinks, 'cbFlop', 'made');
          if (textureBucket) textureBucket.cbFlop.made++;
        }
      }

      if (isPlayer) {
        if (a.actionType === 'FOLD') {
          stillIn = false;
          // folding to a cbet: the first action this street was a bet, not by us, and this is our first response
          if (isFlop && wasPreflopAggressor === false && i > 0) {
            const priorBet = streetActions.slice(0, i).find(x => x.actionType === 'BET' || x.actionType === 'RAISE');
            if (priorBet && streetActions[0].actionType === 'BET') {
              bump(sinks, 'foldToCbFlop', 'made');
              if (textureBucket) textureBucket.foldToCbFlop.made++;
            }
          }
        }
        if (a.actionType === 'CHECK') hasCheckedThisStreet = true;
        if (a.actionType === 'RAISE' && hasCheckedThisStreet) {
          bump(sinks, 'checkRaise', 'opportunities');
          bump(sinks, 'checkRaise', 'made');
          if (isFlop && textureBucket) {
            textureBucket.checkRaise.opportunities++;
            textureBucket.checkRaise.made++;
          }
        }
        if (a.actionType === 'BET' || a.actionType === 'RAISE') acc.aggBets++;
        if (a.actionType === 'CALL') acc.aggCalls++;
      }
    }

    // foldToCbFlop opportunity: we faced a flop bet from the preflop aggressor as our first action
    if (isFlop && !wasPreflopAggressor) {
      const firstAction = streetActions[0];
      if (firstAction && (firstAction.actionType === 'BET')) {
        const ourFirstResponse = streetActions.find(a => a.player === name);
        if (ourFirstResponse) {
          bump(sinks, 'foldToCbFlop', 'opportunities');
          if (textureBucket) textureBucket.foldToCbFlop.opportunities++;
        }
      }
    }
  }

  return stillIn;
}

function accumulateShowdown(hand, name, sawFlop, stillInAfterPostflop, isWinner, acc, posStats, groupBuckets) {
  const sinks = [acc, posStats, ...groupBuckets];
  const hadShowdown = (hand.actions || []).some(
    a => a.actionType === 'SHOW_HAND' || a.actionType === 'MUCK'
  );

  if (sawFlop) {
    bump(sinks, 'wwsf', 'opportunities');
    if (isWinner) bump(sinks, 'wwsf', 'made');

    // wtsd opportunity = every hand where the player saw the flop and
    // was still in the hand postflop. wtsd made = the subset that
    // actually reached showdown. These must NOT be incremented in the
    // same branch, or the rate is trivially always 100%.
    if (stillInAfterPostflop) {
      bump(sinks, 'wtsd', 'opportunities');
      if (hadShowdown) {
        bump(sinks, 'wtsd', 'made');
        bump(sinks, 'wsd', 'opportunities');
        if (isWinner) bump(sinks, 'wsd', 'made');
      }
    }
  }
}

export function computeStatsForHands(hands, matchPlayer) {
  const acc = newAccumulator();

  for (const hand of hands) {
    const player = (hand.players || []).find(p => matchPlayer(p, hand));
    if (!player || player.isSittingOut) continue;

    acc.hands++;
    const positionMap = getPositionMap(hand);
    const name = player.name;

    const position = positionMap[name] || null;
    const tableSize = Object.keys(positionMap).length;
    // Only bucket by position when we actually resolved one for this
    // player (getPositionMap can come back empty if no dealer flag was
    // present on the hand) - global stats above are unaffected either way.
    const posBucket = position && tableSize >= 2 ? ensurePositional(acc, tableSize) : null;
    const posStats = posBucket ? ensurePositionStats(posBucket, position) : null;
    if (posStats) acc.handsWithPosition++;

    // Grouping dimensions that don't exist for this hand (no stakes
    // recorded, no effective-stack figure) simply resolve to a null key,
    // which ensureGroup turns into "no bucket" rather than a bad one.
    const stakesKey = hand.stakes || null;
    const stackDepthKey = player.effectiveStackBB != null ? getStackDepthBucket(player.effectiveStackBB) : null;
    const combinedKey = (stakesKey != null && stackDepthKey != null) ? `${stakesKey}__${stackDepthKey}` : null;

    const stakesBucket = ensureGroup(acc.byStakes, stakesKey, newGroupStats);
    const stackDepthBucket = ensureGroup(acc.byStackDepth, stackDepthKey, newGroupStats);
    const combinedBucket = ensureGroup(acc.byStakesAndStackDepth, combinedKey, newGroupStats);
    if (stakesBucket) stakesBucket.hands++;
    if (stackDepthBucket) stackDepthBucket.hands++;
    if (combinedBucket) combinedBucket.hands++;
    const groupBuckets = [stakesBucket, stackDepthBucket, combinedBucket].filter(Boolean);

    const { sawFlop } = accumulatePreflop(hand, positionMap, name, acc, posBucket, posStats, groupBuckets);

    let stillIn = true;
    if (sawFlop && hand.board?.flop?.length) {
      const wasPreflopAggressor = (hand.actions || [])
        .filter(a => a.street === 'PREFLOP' && (a.actionType === 'RAISE' || a.actionType === 'BET'))
        .slice(-1)[0]?.player === name;

      // Texture is only resolvable for a well-formed 3-card flop; a
      // malformed board (parsing gap on old data) just means no texture
      // bucket for this hand, not a thrown error.
      let textureBucket = null;
      if (hand.board.flop.length === 3) {
        const wetness = classifyFlopTexture(parseBoard(hand.board.flop)).wetness;
        textureBucket = ensureGroup(acc.byFlopTexture, wetness, newTextureStats);
        if (textureBucket) textureBucket.hands++;
      }

      stillIn = accumulatePostflop(hand, name, wasPreflopAggressor, acc, posStats, groupBuckets, textureBucket);
    }

    const isWinner = (hand.winners || []).includes(name);
    accumulateShowdown(hand, name, sawFlop && hand.board?.flop?.length > 0, stillIn, isWinner, acc, posStats, groupBuckets);

    for (const sink of [acc, ...groupBuckets]) bumpProfit(sink, hand, player);
  }

  return finalize(acc);
}

function pct(made, opportunities) {
  return opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0;
}

// `confidence` is computed here - once, where the stat is assembled - and
// stored alongside pct/made/opportunities, rather than left for the
// frontend to derive ad hoc from `opportunities`. That's what keeps it
// from drifting out of sync with the underlying sample: every consumer
// (API, UI, a future export) reads the same precomputed label. `statKey`
// picks the confidence profile (see confidence.js's RARE_STAT_KEYS) -
// omit it only for stats with no natural key (there are none left after
// this refactor, but the parameter defaults safely regardless).
function finalizeRate(rate, statKey) {
  return {
    pct: pct(rate.made, rate.opportunities),
    made: rate.made,
    opportunities: rate.opportunities,
    confidence: getConfidenceForStat(statKey, rate.opportunities)
  };
}

function finalizeVsStat(stat) {
  const faced = stat.faced;
  return {
    faced,
    folded: stat.folded,
    called: stat.called,
    raised: stat.raised,
    foldPct: pct(stat.folded, faced),
    callPct: pct(stat.called, faced),
    raisePct: pct(stat.raised, faced),
    // defend = anything that isn't folding (call or raise/re-raise)
    defendPct: pct(stat.called + stat.raised, faced),
    // Every position-matrix cell (a single attacker/responder pairing) is
    // inherently a small slice of the data, regardless of which matrix or
    // positions it is - always the stricter 'rare' profile, not looked up
    // per-key the way finalizeRate's stats are.
    confidence: getConfidence(faced, CONFIDENCE_PROFILES.rare)
  };
}

function finalizePositionStats(stats) {
  const out = {};
  for (const key of Object.keys(stats)) {
    out[key] = finalizeRate(stats[key], key);
  }
  return out;
}

function finalizeMatrix(matrix) {
  const out = {};
  for (const attacker of Object.keys(matrix)) {
    out[attacker] = {};
    for (const responder of Object.keys(matrix[attacker])) {
      out[attacker][responder] = finalizeVsStat(matrix[attacker][responder]);
    }
  }
  return out;
}

function finalizePositional(positional) {
  const out = {};
  for (const tableSize of Object.keys(positional)) {
    const bucket = positional[tableSize];
    const positions = {};
    for (const pos of Object.keys(bucket.positions)) {
      positions[pos] = finalizePositionStats(bucket.positions[pos]);
    }
    out[tableSize] = {
      positions,
      vsOpen: finalizeMatrix(bucket.vsOpen),
      vs3Bet: finalizeMatrix(bucket.vs3Bet)
    };
  }
  return out;
}

// Non-rate-stat fields on newGroupStats()/newAccumulator() - handled by
// finalizeProfitLoss below instead of the generic finalizeRate loop.
const PROFIT_FIELD_KEYS = new Set(['totalProfitLoss', 'handsWithProfitData', 'bbUnitsWon', 'handsWithBbData', 'currencies']);

// Shared by the top-level accumulator and every grouping bucket: same
// currency-safety rule either way - totalProfitLoss/bb100 only mean
// anything as a single scalar when every hand in the slice shares one
// currency, otherwise the caller gets an explicit null instead of a
// silently-wrong mixed-unit number.
function finalizeProfitLoss(sink) {
  return {
    totalProfitLoss: Math.round(sink.totalProfitLoss * 100) / 100,
    handsWithProfitData: sink.handsWithProfitData,
    bb100: (sink.handsWithBbData > 0 && sink.currencies.size <= 1)
      ? Math.round((sink.bbUnitsWon / sink.handsWithBbData) * 100 * 100) / 100
      : null,
    currency: sink.currencies.size === 1 ? [...sink.currencies][0] : null
  };
}

// Shared finalizer for every "group by X" bucket (byStakes, byStackDepth,
// byStakesAndStackDepth, byFlopTexture): converts each bucket's raw made/
// opportunities counters to {pct, made, opportunities} in one generic pass
// instead of one hand-written finalizer per dimension. Profitability (see
// finalizeProfitLoss above) is only attached for buckets that actually
// track it - newTextureStats() deliberately doesn't, since attributing a
// whole hand's profit to one flop-texture bucket isn't a meaningful figure
// the way it is for a stakes/stack-depth slice.
function finalizeGroupStats(bucket) {
  const out = { hands: bucket.hands };
  for (const key of Object.keys(bucket)) {
    if (key === 'hands' || PROFIT_FIELD_KEYS.has(key)) continue;
    out[key] = finalizeRate(bucket[key], key);
  }
  const hasProfitFields = bucket.currencies instanceof Set;
  return hasProfitFields ? { ...out, ...finalizeProfitLoss(bucket) } : out;
}

function finalizeGroupMap(map) {
  const out = {};
  for (const key of Object.keys(map)) {
    out[key] = finalizeGroupStats(map[key]);
  }
  return out;
}

// Every top-level rate-stat key, in display order. Looping over this
// (rather than repeating each key twice as `key: finalizeRate(acc.key)`)
// is what makes finalizeRate's statKey argument (-> confidence profile)
// impossible to forget for a newly-added stat - and matches how
// finalizeGroupStats/finalizePositionStats already derive it from the
// object's own keys instead of a hand-written list.
const TOP_LEVEL_RATE_KEYS = [
  'vpip', 'pfr', 'open', 'threeBet', 'foldTo3Bet', 'fourBet', 'foldTo4Bet',
  'steal', 'foldToSteal', 'limp', 'coldCall', 'cbFlop', 'foldToCbFlop',
  'checkRaise', 'wtsd', 'wsd', 'wwsf'
];

function finalize(acc) {
  const aggPct = (acc.aggBets + acc.aggCalls) > 0
    ? Math.round((acc.aggBets / (acc.aggBets + acc.aggCalls)) * 1000) / 10
    : 0;
  const aggFactor = acc.aggCalls > 0 ? Math.round((acc.aggBets / acc.aggCalls) * 100) / 100 : acc.aggBets > 0 ? null : 0;

  const rateStats = {};
  for (const key of TOP_LEVEL_RATE_KEYS) rateStats[key] = finalizeRate(acc[key], key);

  return {
    totalHands: acc.hands,
    ...rateStats,
    aggPct,
    aggFactor,
    // totalProfitLoss/bb100/currency: see finalizeProfitLoss above - same
    // "null if mixed currencies" rule this used to compute inline (e.g. a
    // real-money site + a play-chip home game mixed together).
    ...finalizeProfitLoss(acc),
    // Position-vs-position breakdown, bucketed by table size (2-9 active
    // players). See ensurePositional/ensureVsOpen/ensureVs3Bet above for
    // the shape. Keys are stringified table sizes ("6", "9", ...) because
    // that's what plain-object/JSON round-tripping gives us.
    positional: finalizePositional(acc.positional),
    // Same stat set as the top level, sliced by grouping dimension. Keys
    // are raw stakes strings ("$1/$2"), stack-depth buckets ('short'|
    // 'mid'|'deep'), or a `${stakes}__${bucket}` combination - see
    // ensureGroup()/newGroupStats() above.
    byStakes: finalizeGroupMap(acc.byStakes),
    byStackDepth: finalizeGroupMap(acc.byStackDepth),
    byStakesAndStackDepth: finalizeGroupMap(acc.byStakesAndStackDepth),
    // 'dry'|'semi-wet'|'wet' -> { hands, cbFlop, foldToCbFlop, checkRaise }
    // - only the flop-street stats that depend on board texture. See
    // flopTexture.js for the wetness heuristic.
    byFlopTexture: finalizeGroupMap(acc.byFlopTexture),
    // How many hands actually had a resolvable position (dealer flag +
    // >=2 active players) vs. total hands seen. If hands is 0 while
    // totalHands is high, the underlying hand data is missing isDealer -
    // that's a parsing/import issue, not a UI issue.
    positionCoverage: { hands: acc.handsWithPosition, totalHands: acc.hands }
  };
}

// Matcher helpers so callers don't have to hand-roll the comparison.
export const matchByPersonId = personId => (p) => p.personId && String(p.personId) === String(personId);
export const matchHero = () => (p) => p.isHero === true;
