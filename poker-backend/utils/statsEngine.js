// Generalized (non-heads-up-only) player stats engine.
// Takes an array of Hand documents + a matcher function that picks the
// target player's entry out of hand.players, and returns one stats object.
// Used both for opponents (match by personId) and hero (match by isHero).

import { parseBigBlind, CENTS_CURRENCIES } from './blinds.js';
import { getStackDepthBucket } from './stackDepth.js';
import { parseBoard } from './cardParser.js';
import { classifyFlopTexture } from './flopTexture.js';
import { classifyHoleCards } from './handClass.js';
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

// wonNoShowdown/wonAtShowdown/lostNoShowdown/lostAtShowdown - the "Showdown
// breakdown" donut on the Study page. A hand-wide classification (unlike
// the rate stats above, not gated on having seen a flop), computed
// directly from hand.actions in computeStatsForHands rather than threaded
// through accumulatePreflop/Postflop, since "did this player fold at any
// point" and "did the hand reach a showdown at all" are both simplest to
// answer from the raw action list once per hand.
function newShowdownBreakdown() {
  return { wonNoShowdown: 0, wonAtShowdown: 0, lostNoShowdown: 0, lostAtShowdown: 0 };
}

function newPositionStats() {
  return {
    hands: 0,
    vpip: newRateStat(),
    pfr: newRateStat(),
    open: newRateStat(),
    steal: newRateStat(),
    // foldToSteal/limp/coldCall were already being mirrored into posStats
    // by the generic bump() sinks mechanism (accumulatePreflop already
    // passes posStats as a sink for all three) - same no-op-until-the-key-
    // exists mechanism as checkRaise/wsd below. Adding the fields here is
    // the only change needed to start populating them per-position, for
    // the Study page's "Preflop matrix by position" table.
    foldToSteal: newRateStat(),
    limp: newRateStat(),
    coldCall: newRateStat(),
    threeBet: newRateStat(),
    foldTo3Bet: newRateStat(),
    fourBet: newRateStat(),
    foldTo4Bet: newRateStat(),
    cbFlop: newRateStat(),
    foldToCbFlop: newRateStat(),
    // Barrel-chain continuation bets - see accumulatePostflop's
    // barrelAlive tracking: opportunity requires having bet the
    // immediately preceding street, not just having been the preflop
    // aggressor at some point.
    cbTurn: newRateStat(),
    cbRiver: newRateStat(),
    // Betting out of turn relative to whoever actually holds the lead -
    // see accumulatePostflop's globalAggressor tracking.
    donk: newRateStat(),
    probe: newRateStat(),
    // checkRaise/wsd were already being mirrored into posStats by the
    // generic bump() sinks mechanism (accumulatePostflop/accumulateShowdown
    // already pass posStats as a sink for both) - they just silently
    // no-op'd because bump() skips a sink that doesn't have the target key.
    // Adding the fields here is the only change needed to start populating
    // them per-position, for the Study page's "Postflop matrix by
    // position" (checkRaise) and "W$SD" column (wsd).
    checkRaise: newRateStat(),
    wtsd: newRateStat(),
    wsd: newRateStat(),
    wwsf: newRateStat(),
    // Per-position aggression factor ("AF" column, postflop matrix) - bets
    // and raises vs calls, same definition as the top-level aggFactor.
    aggBets: 0,
    aggCalls: 0,
    // Per-position profitability (bb100 "Win rate by position" on Study) -
    // same fields/semantics as newAccumulator()'s top-level ones, tracked
    // via the same bumpProfit()/finalizeProfitLoss() used everywhere else.
    totalProfitLoss: 0,
    handsWithProfitData: 0,
    bbUnitsWon: 0,
    handsWithBbData: 0,
    currencies: new Set()
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

// Profit-only bucket shape shared by every level of the hand-class
// breakdown (category, specific hand, preflop context, position-within-
// context) - same fields bumpProfit()/finalizeProfitLoss() already expect,
// just without any rate-stat counters, since "how often did I play this"
// isn't the question here (unlike positional/byStakes) - only "how did it
// go when I did".
function newProfitOnlyBucket() {
  return { hands: 0, totalProfitLoss: 0, handsWithProfitData: 0, bbUnitsWon: 0, handsWithBbData: 0, currencies: new Set() };
}

// One per specific 169-hand-class token (e.g. "AKs", "76o", "AA").
// `category` is stamped once at creation (see classifyHoleCards) so the
// frontend can group hand rows under their category without re-deriving
// the classification rules itself.
function newHandClassBucket(category) {
  return { ...newProfitOnlyBucket(), category, contexts: {} };
}

// One per preflop context (open/limp/threeBet/... - see
// classifyHeroPreflopContext) within a specific hand class.
function newHandClassContextBucket() {
  return { ...newProfitOnlyBucket(), byPosition: {} };
}

// hero's flop-street action mix (byBoardTexture) - counts of hero's FIRST
// flop action by type, plus `total` (the sample size behind the mix) so a
// consumer doesn't have to sum the five counters itself.
function newActionMixCounters() {
  return { bet: 0, check: 0, raise: 0, call: 0, fold: 0, total: 0 };
}

// Running sum for bet/raise sizing as a fraction of the pot before the
// action (byBoardTexture) - kept as a sum+count pair rather than an array
// so finalizing is a single division, same shape as bbUnitsWon/handsWithBbData.
function newSizingAccumulator() {
  return { sizingSum: 0, sizingCount: 0 };
}

// One per flop-texture tag ('monotone'|'twoTone'|'rainbow'|'paired'|
// 'trips'|'connected'|'acehigh' - see flopTexture.js). Unlike every other
// grouping dimension in this file, a single flop can match several tags at
// once (see boardTextureTagsFor/accumulateBoardTextureTag below), so each
// tag gets its own independent bucket rather than the hand picking one key.
function newBoardTextureTagBucket() {
  return { ...newProfitOnlyBucket(), actionMix: newActionMixCounters(), sizing: newSizingAccumulator(), contexts: {} };
}

// One per preflop context within a texture tag - same profit/actionMix/
// sizing fields as the tag bucket, plus a further hand-class breakdown
// ("what hands was I doing this with").
function newBoardTextureContextBucket() {
  return { ...newProfitOnlyBucket(), actionMix: newActionMixCounters(), sizing: newSizingAccumulator(), handClasses: {} };
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

function newMatrixCell() {
  return { fold: 0, call: 0, raise: 0, total: 0 };
}

// acc.preflopMatrix[tableSize][scenario][heroPos][...][token] - the Study
// page's range-matrix grid: for each 169-hand-class token, how often hero
// folded/called/raised in a given scenario. Keyed hero-position-first
// (unlike ensureVsOpen/ensureVs3Bet's attacker-first vsOpen/vs3Bet above),
// since the range-matrix UI's primary selector is always "hero position" -
// this avoids re-keying the data client-side. `rfi` has no facing position
// (nobody's opened yet); every other scenario (`vsOpen`, `vs3Bet`,
// `vs4Bet`, ... - unbounded, see matrixScenarioForLevel below) nests one
// level deeper by facingPos, the position of whoever made the raise hero is
// directly responding to. Only populated for tableSize 6-9 - the UI lets
// hero switch between 6/7/8/9-handed views (see that gate at its call site
// in computeStatsForHands); smaller sizes (heads-up, 3-5 handed) aren't
// wired into the range-matrix UI so accumulating them would just bloat the
// doc.
function ensurePreflopMatrixCell(acc, tableSize, scenario, heroPos, facingPos, token) {
  if (!heroPos || !token) return null;
  if (!acc.preflopMatrix[tableSize]) acc.preflopMatrix[tableSize] = {};
  const sizeBucket = acc.preflopMatrix[tableSize];
  if (!sizeBucket[scenario]) sizeBucket[scenario] = {};
  const scenarioBucket = sizeBucket[scenario];

  if (scenario === 'rfi') {
    if (!scenarioBucket[heroPos]) scenarioBucket[heroPos] = {};
    if (!scenarioBucket[heroPos][token]) scenarioBucket[heroPos][token] = newMatrixCell();
    return scenarioBucket[heroPos][token];
  }

  if (!facingPos) return null;
  if (!scenarioBucket[heroPos]) scenarioBucket[heroPos] = {};
  if (!scenarioBucket[heroPos][facingPos]) scenarioBucket[heroPos][facingPos] = {};
  if (!scenarioBucket[heroPos][facingPos][token]) scenarioBucket[heroPos][facingPos][token] = newMatrixCell();
  return scenarioBucket[heroPos][facingPos][token];
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
    cbTurn: newRateStat(),
    cbRiver: newRateStat(),
    donk: newRateStat(),
    probe: newRateStat(),
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
    // Flop-texture-tag breakdown - see newBoardTextureTagBucket() and
    // accumulateBoardTextureTag() below. Independent from byFlopTexture
    // above (mutually-exclusive wetness): a flop can match several tags at
    // once (e.g. monotone AND acehigh), so a hand is mirrored into every
    // tag it qualifies for.
    byBoardTexture: {},
    // 169-hand-class token (e.g. "AKs") -> newHandClassBucket(); broad
    // display category (e.g. 'pocketPairs') -> newProfitOnlyBucket() - see
    // handClass.js/classifyHeroPreflopContext above. Only accumulated for
    // hands the player voluntarily entered preflop (see
    // classifyHeroPreflopContext's null-context rule) - a folded-first-in
    // hand carries no hand-class signal, just blind-loss noise.
    byHandClass: {},
    byHandClassCategory: {},
    // tableSize -> scenario ('rfi'|'vsOpen'|'vs3Bet'|'vs4Bet'|... - see
    // matrixScenarioForLevel, unbounded) -> heroPos -> (token, for rfi) or
    // facingPos -> token (every other scenario) -> newMatrixCell(). See
    // ensurePreflopMatrixCell above. Only populated for tableSize 6-9 (the
    // range-matrix UI's table-size filter).
    preflopMatrix: {},
    // Won/lost x with/without showdown, hand-wide (not per-position) - the
    // "Showdown breakdown" donut on the Study page. See
    // newShowdownBreakdown() above for the classification.
    showdownBreakdown: newShowdownBreakdown(),
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

// Standalone counterpart to accumulatePreflop's level-tracking, for the
// hand-class breakdown: that function bumps aggregate made/opportunities
// counters and is entangled with the sinks/bump() machinery, but the
// hand-class breakdown needs a single label per hand ("this AKs was an
// open", "this 76s was a fold to a 4-bet") rather than an aggregate. Kept
// as its own pass over hand.actions rather than threading a return value
// through accumulatePreflop, to avoid risking the already-tested aggregate
// logic there.
//
// Returns null for any hand where `name` never voluntarily put money in
// preflop (folded first-in, or simply wasn't dealt a decision) - blend-in
// hands like that would just dilute every hand class's win rate with a
// trivial small loss and add no signal (same reasoning real HUD tools use
// for "hand class" stats: only played hands count).
const CONTEXT_ORDER = [
  'open', 'threeBet', 'fourBet', 'fiveBet',
  'coldCall', 'callVs3Bet', 'callVs4Bet',
  'limp', 'checkedOption',
  'foldTo3Bet', 'foldTo4Bet', 'foldPreflop'
];

function classifyHeroPreflopContext(hand, name) {
  const real = (hand.actions || []).filter(
    a => a.street === 'PREFLOP' && a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB'
  );

  let level = 0;
  let playerHasVpipd = false;
  const facedAtLevel = new Set();
  let context = null;

  for (const a of real) {
    if (a.player === name && !facedAtLevel.has(level)) {
      facedAtLevel.add(level);

      if (level === 0) {
        if (a.actionType === 'RAISE' || a.actionType === 'BET') context = 'open';
        else if (a.actionType === 'CALL') context = 'limp';
        else if (a.actionType === 'CHECK') context = 'checkedOption';
      } else if (level === 1) {
        // Facing an open: raising here is the *second* raise of the hand -
        // a 3-bet, not an open. A fold here has no dedicated label unless
        // hero already had money in (e.g. limped, then folded to a raise).
        if (a.actionType === 'RAISE') context = 'threeBet';
        else if (a.actionType === 'CALL') context = 'coldCall';
        else if (a.actionType === 'FOLD' && playerHasVpipd) context = 'foldPreflop';
      } else if (level === 2) {
        // Facing a 3-bet.
        if (a.actionType === 'RAISE') context = 'fourBet';
        else if (a.actionType === 'CALL') context = 'callVs3Bet';
        else if (a.actionType === 'FOLD' && playerHasVpipd) context = 'foldTo3Bet';
      } else {
        // Facing a 4-bet or deeper (level >= 3). A 5-bet+ jam and a call
        // facing any of these get one label apiece rather than a label per
        // level - deep re-raises are rare enough that splitting further
        // adds noise, not signal (same reasoning fourBet used to apply one
        // level shallower, before 5-Bet got its own bucket). Folding still
        // only gets its own 'foldTo4Bet' label at exactly level 3 (facing a
        // 4-bet); anything deeper falls into the generic foldPreflop
        // catch-all, unchanged from before this level was split out.
        if (a.actionType === 'FOLD' && playerHasVpipd) context = level === 3 ? 'foldTo4Bet' : 'foldPreflop';
        else if (a.actionType === 'CALL') context = 'callVs4Bet';
        else if (a.actionType === 'RAISE') context = 'fiveBet';
      }

      if (a.actionType === 'CALL' || a.actionType === 'RAISE' || a.actionType === 'BET') {
        playerHasVpipd = true;
      }
    }

    if (a.actionType === 'RAISE' || a.actionType === 'BET') level++;
  }

  return context;
}

// Every independent flop-texture facet a board can carry (see
// classifyFlopTexture in flopTexture.js) - unlike `wetness` (exactly one of
// dry/semi-wet/wet per board), a board can match several of these at once
// (e.g. monotone AND acehigh), so this is a facet list, not a partition.
const TEXTURE_TAG_KEYS = ['monotone', 'twoTone', 'rainbow', 'paired', 'trips', 'connected', 'acehigh'];

// Which of TEXTURE_TAG_KEYS this flop actually matches.
function boardTextureTagsFor(textureInfo) {
  return TEXTURE_TAG_KEYS.filter(key => textureInfo[key]);
}

// Hero's first FLOP-street action, plus the pot size immediately before it
// (the previous action's potSizeAfter in the hand's whole chronological
// action log, or 0 if it's the very first action of the hand) - needed for
// both the byBoardTexture action-mix and bet/raise sizing figures. Returns
// null if hero never acted on the flop (e.g. everyone else was already
// all-in before action reached hero).
function extractHeroFirstFlopAction(hand, name) {
  const actions = hand.actions || [];
  const idx = actions.findIndex(a => a.street === 'FLOP' && a.player === name);
  if (idx === -1) return null;
  const action = actions[idx];
  return { actionType: action.actionType, amount: action.amount, potBefore: idx > 0 ? actions[idx - 1].potSizeAfter : 0 };
}

function bumpActionMix(mix, firstFlopAction) {
  if (!firstFlopAction) return;
  mix.total++;
  const key = { BET: 'bet', CHECK: 'check', RAISE: 'raise', CALL: 'call', FOLD: 'fold' }[firstFlopAction.actionType];
  if (key) mix[key]++;
}

// Sizing is only meaningful for hero's own bet/raise (a call/check/fold has
// no "size hero chose"), and only when a real pot-before figure exists.
function bumpSizing(sizing, firstFlopAction) {
  if (!firstFlopAction) return;
  if (firstFlopAction.actionType !== 'BET' && firstFlopAction.actionType !== 'RAISE') return;
  if (!firstFlopAction.potBefore || firstFlopAction.potBefore <= 0) return;
  sizing.sizingSum += firstFlopAction.amount / firstFlopAction.potBefore;
  sizing.sizingCount++;
}

// Bumps one texture tag's full tag -> context -> handClass subtree for this
// hand. Called once per applicable tag (see boardTextureTagsFor) - a
// deliberate deviation from every other ensureGroup() call site in this
// file, which picks a single bucket key per hand; a flop's texture tags
// aren't mutually exclusive, so a hand can (and often does) get mirrored
// into more than one tag's bucket.
function accumulateBoardTextureTag(byBoardTexture, tag, hand, player, preflopContext, classInfo, firstFlopAction) {
  const tagBucket = ensureGroup(byBoardTexture, tag, newBoardTextureTagBucket);
  tagBucket.hands++;
  bumpProfit(tagBucket, hand, player);
  bumpActionMix(tagBucket.actionMix, firstFlopAction);
  bumpSizing(tagBucket.sizing, firstFlopAction);

  const ctxBucket = ensureGroup(tagBucket.contexts, preflopContext, newBoardTextureContextBucket);
  ctxBucket.hands++;
  bumpProfit(ctxBucket, hand, player);
  bumpActionMix(ctxBucket.actionMix, firstFlopAction);
  bumpSizing(ctxBucket.sizing, firstFlopAction);

  const handClassBucket = ensureGroup(ctxBucket.handClasses, classInfo.token, newProfitOnlyBucket);
  handClassBucket.hands++;
  bumpProfit(handClassBucket, hand, player);
}

// Standalone counterpart to classifyHeroPreflopContext, for the range-matrix
// grid (acc.preflopMatrix) rather than the profit-based hand-class
// breakdown. Deliberately NOT a reuse of classifyHeroPreflopContext: that
// function returns null (no context) for any hand where hero never
// voluntarily put money in preflop - correct for "win rate by hand class"
// (a folded-first-in hand has no profit signal worth attributing), but
// wrong here, where an accurate RFI fold% needs those folds counted. So
// this is its own pass over hand.actions, with its own level/facedAtLevel
// bookkeeping (same pattern as accumulatePreflop/classifyHeroPreflopContext)
// plus raiserPositionAtLevel tracking (accumulatePreflop already has this,
// classifyHeroPreflopContext doesn't need it - added here since the
// range-matrix's vsOpen/vs3Bet scenarios need to know exactly which
// position hero is facing).
//
// Scenario name for facing the raise that put the action at `level`
// (level 0 = nobody's raised yet). Matches standard poker naming: the
// opening raise is "the open" (not "the 2-bet", even though it's
// technically the second aggressive action after the blind); a re-raise
// over that is a 3-bet, the next a 4-bet, and so on - so raiserPositionAtLevel[L]
// (L>=2) made the "(L+1)-bet", while L===1 is special-cased to 'vsOpen'
// instead of the technically-consistent-but-never-said-aloud 'vs2Bet'.
// Unbounded - a hand can 5-bet, 6-bet, 7-bet jam, etc., and each still
// gets its own scenario key rather than being folded into a catch-all.
function matrixScenarioForLevel(level) {
  if (level === 0) return 'rfi';
  if (level === 1) return 'vsOpen';
  return `vs${level + 1}Bet`;
}

// Returns an array of { scenario, action, facingPosition } entries, one per
// distinct preflop decision hero faces, at any depth (rfi / vsOpen /
// vs3Bet / vs4Bet / vs5Bet / ...) - usually just one (hero's entry into the
// pot), but more when hero re-enters the hand at a deeper level: e.g. hero
// opens (rfi:raise at level 0) and later faces a squeeze 3-bet (vs3Bet at
// level 2), or hero cold-calls an open (vsOpen:call at level 1), the pot
// gets 3-bet and 4-bet by others, and hero faces the 4-bet (vs4Bet at level
// 3). facingPosition is null for `rfi` (nobody's opened yet); for every
// other scenario it's whoever made the raise hero is directly responding
// to - note this does NOT capture the full action history before that (a
// vs4Bet cell mixes hands with different 3-bettors, since we only track the
// immediate facing position at each level, not the whole preceding chain).
function classifyHeroPreflopMatrixDecision(hand, name, positionMap) {
  const real = (hand.actions || []).filter(
    a => a.street === 'PREFLOP' && a.actionType !== 'POST_SB' && a.actionType !== 'POST_BB'
  );

  let level = 0;
  const raiserPositionAtLevel = {};
  const facedAtLevel = new Set();
  const decisions = [];

  for (const a of real) {
    if (a.player === name && !facedAtLevel.has(level)) {
      facedAtLevel.add(level);
      const scenario = matrixScenarioForLevel(level);
      const facingPosition = level === 0 ? null : (raiserPositionAtLevel[level] || null);

      if (a.actionType === 'RAISE' || a.actionType === 'BET') decisions.push({ scenario, action: 'raise', facingPosition });
      else if (a.actionType === 'CALL' || (level === 0 && a.actionType === 'CHECK')) decisions.push({ scenario, action: 'call', facingPosition });
      else if (a.actionType === 'FOLD') decisions.push({ scenario, action: 'fold', facingPosition });
    }

    if (a.actionType === 'RAISE' || a.actionType === 'BET') {
      level++;
      raiserPositionAtLevel[level] = positionMap[a.player];
    }
  }

  return decisions;
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

  // Barrel-chain c-bet (flop -> turn -> river, the "Postflop matrix"
  // C-Bet Turn/River columns): each street's c-bet opportunity is gated on
  // having MADE the c-bet on the street immediately before it ("did you
  // fire again"), not just on ever having been the preflop aggressor.
  // FLOP's own gate stays exactly the existing wasPreflopAggressor check;
  // this only extends the SAME idea forward one street at a time.
  let barrelAlive = wasPreflopAggressor;

  // Whoever bet/raised last, on any street so far (including preflop) -
  // carries forward unchanged through a fully-checked street (real
  // betting initiative doesn't reset just because everyone checked).
  // Needed for donk/probe, which are about `name` acting *out of turn*
  // relative to whoever genuinely holds the lead, not about `name`'s own
  // c-bet status - a different question from the barrel chain above, so
  // tracked separately rather than reusing barrelAlive.
  let globalAggressor = (hand.actions || [])
    .filter(a => a.street === 'PREFLOP' && (a.actionType === 'RAISE' || a.actionType === 'BET'))
    .slice(-1)[0]?.player ?? null;
  // Did the immediately preceding postflop street see any bet/raise at
  // all, from anyone? Only meaningful starting TURN (probe is a TURN/
  // RIVER concept - preflop essentially never goes bet-free once blinds
  // are posted, so a "flop probe" isn't a coherent spot).
  let previousStreetHadBet = null;

  for (const street of streets) {
    const streetActions = (hand.actions || []).filter(a => a.street === street);
    if (streetActions.length === 0) continue;

    const isFlop = street === 'FLOP';
    const cbetKey = isFlop ? 'cbFlop' : (street === 'TURN' ? 'cbTurn' : 'cbRiver');
    const enteringAggressor = globalAggressor;
    const priorStreetHadBet = previousStreetHadBet;
    const firstAction = streetActions[0];
    const firstActorIsName = firstAction.player === name;
    let hasCheckedThisStreet = false;

    // Donk bet: `name` is live, is NOT the player who actually holds the
    // betting lead coming into this street (a specific someone else
    // does), and `name` bets as the very first action of the street -
    // leading out before the real aggressor gets a chance to continue
    // betting. A RAISE here isn't a donk (that's just a raise/check-raise
    // once someone else has already acted).
    if (enteringAggressor && enteringAggressor !== name && firstActorIsName) {
      bump(sinks, 'donk', 'opportunities');
      if (firstAction.actionType === 'BET') bump(sinks, 'donk', 'made');
    }

    // Probe bet: the street before this one was fully checked through (no
    // bets from anyone, including whoever's presumed to hold the lead -
    // if THEY bet after checking back a street, that's a delayed c-bet,
    // not a probe, so they're excluded here), and `name` - not the
    // presumed aggressor - takes the initiative by betting first now.
    if (!isFlop && priorStreetHadBet === false && enteringAggressor !== name && firstActorIsName) {
      bump(sinks, 'probe', 'opportunities');
      if (firstAction.actionType === 'BET') bump(sinks, 'probe', 'made');
    }

    for (let i = 0; i < streetActions.length; i++) {
      const a = streetActions[i];
      const isPlayer = a.player === name;

      if (!cbTracked && barrelAlive) {
        cbTracked = true;
        bump(sinks, cbetKey, 'opportunities');
        if (isFlop && textureBucket) textureBucket.cbFlop.opportunities++;
        if (firstAction.player === name && (firstAction.actionType === 'BET' || firstAction.actionType === 'RAISE')) {
          bump(sinks, cbetKey, 'made');
          if (isFlop && textureBucket) textureBucket.cbFlop.made++;
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
        if (a.actionType === 'BET' || a.actionType === 'RAISE') {
          acc.aggBets++;
          if (posStats) posStats.aggBets++;
        }
        if (a.actionType === 'CALL') {
          acc.aggCalls++;
          if (posStats) posStats.aggCalls++;
        }
      }
    }

    // foldToCbFlop opportunity: we faced a flop bet from the preflop aggressor as our first action
    if (isFlop && !wasPreflopAggressor) {
      if (firstAction && (firstAction.actionType === 'BET')) {
        const ourFirstResponse = streetActions.find(a => a.player === name);
        if (ourFirstResponse) {
          bump(sinks, 'foldToCbFlop', 'opportunities');
          if (textureBucket) textureBucket.foldToCbFlop.opportunities++;
        }
      }
    }

    // Chain state forward for the next street: the barrel stays alive
    // only if `name` actually fired this street's c-bet (not merely had
    // the opportunity); the global aggressor/bet-seen flags update from
    // this street's real action log, independent of `name`.
    barrelAlive = cbTracked && firstAction.player === name && (firstAction.actionType === 'BET' || firstAction.actionType === 'RAISE');
    cbTracked = false; // reset per street - it's a "counted once THIS street" guard, not hand-wide
    let streetHadBet = false;
    for (const a of streetActions) {
      if (a.actionType === 'BET' || a.actionType === 'RAISE') {
        globalAggressor = a.player;
        streetHadBet = true;
      }
    }
    previousStreetHadBet = streetHadBet;
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
    if (posStats) { acc.handsWithPosition++; posStats.hands++; }

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
    // Hoisted out of the `if` below so the byBoardTexture accumulation
    // further down (which needs the FULL classifyFlopTexture() result, not
    // just wetness) can reuse it instead of re-parsing/re-classifying the
    // same board a second time.
    let textureInfo = null;
    let heroFirstFlopAction = null;
    if (sawFlop && hand.board?.flop?.length) {
      const wasPreflopAggressor = (hand.actions || [])
        .filter(a => a.street === 'PREFLOP' && (a.actionType === 'RAISE' || a.actionType === 'BET'))
        .slice(-1)[0]?.player === name;

      // Texture is only resolvable for a well-formed 3-card flop; a
      // malformed board (parsing gap on old data) just means no texture
      // bucket for this hand, not a thrown error.
      let textureBucket = null;
      if (hand.board.flop.length === 3) {
        textureInfo = classifyFlopTexture(parseBoard(hand.board.flop));
        textureBucket = ensureGroup(acc.byFlopTexture, textureInfo.wetness, newTextureStats);
        if (textureBucket) textureBucket.hands++;
        heroFirstFlopAction = extractHeroFirstFlopAction(hand, name);
      }

      stillIn = accumulatePostflop(hand, name, wasPreflopAggressor, acc, posStats, groupBuckets, textureBucket);
    }

    const isWinner = (hand.winners || []).includes(name);
    accumulateShowdown(hand, name, sawFlop && hand.board?.flop?.length > 0, stillIn, isWinner, acc, posStats, groupBuckets);

    // Showdown breakdown: hand-wide (every hand this player was dealt into,
    // not gated on seeing a flop) - "reached showdown" means they didn't
    // fold AND the hand actually had a SHOW_HAND/MUCK event.
    const playerFolded = (hand.actions || []).some(a => a.player === name && a.actionType === 'FOLD');
    const hadShowdownForHand = (hand.actions || []).some(a => a.actionType === 'SHOW_HAND' || a.actionType === 'MUCK');
    const reachedShowdown = !playerFolded && hadShowdownForHand;
    if (isWinner) acc.showdownBreakdown[reachedShowdown ? 'wonAtShowdown' : 'wonNoShowdown']++;
    else acc.showdownBreakdown[reachedShowdown ? 'lostAtShowdown' : 'lostNoShowdown']++;

    for (const sink of [acc, posStats, ...groupBuckets].filter(Boolean)) bumpProfit(sink, hand, player);

    const classInfo = classifyHoleCards(player.holeCards);
    const preflopContext = classInfo ? classifyHeroPreflopContext(hand, name) : null;
    if (classInfo && preflopContext) {
      const categoryBucket = ensureGroup(acc.byHandClassCategory, classInfo.category, newProfitOnlyBucket);
      categoryBucket.hands++;
      bumpProfit(categoryBucket, hand, player);

      const classBucket = ensureGroup(acc.byHandClass, classInfo.token, () => newHandClassBucket(classInfo.category));
      classBucket.hands++;
      bumpProfit(classBucket, hand, player);

      const contextBucket = ensureGroup(classBucket.contexts, preflopContext, newHandClassContextBucket);
      contextBucket.hands++;
      bumpProfit(contextBucket, hand, player);

      if (position) {
        const posInContext = ensureGroup(contextBucket.byPosition, position, newProfitOnlyBucket);
        posInContext.hands++;
        bumpProfit(posInContext, hand, player);
      }

      // Board-texture breakdown: one hand can match several texture tags
      // at once (see boardTextureTagsFor) - only reachable here, same
      // classInfo/preflopContext gate as byHandClass above, since a texture
      // slice without a resolved hand class or preflop context carries the
      // same "no signal" problem byHandClass already avoids.
      if (textureInfo) {
        for (const tag of boardTextureTagsFor(textureInfo)) {
          accumulateBoardTextureTag(acc.byBoardTexture, tag, hand, player, preflopContext, classInfo, heroFirstFlopAction);
        }
      }
    }

    // Range-matrix grid (acc.preflopMatrix) - see classifyHeroPreflopMatrixDecision
    // above for why this is a separate pass from preflopContext (it needs
    // level-0 folds that preflopContext deliberately excludes). Gated to
    // 6-9 handed - see ensurePreflopMatrixCell's comment for why the range
    // stops there rather than covering every size POSITIONS_BY_SIZE knows.
    if (classInfo && tableSize >= 6 && tableSize <= 9 && position) {
      const decisions = classifyHeroPreflopMatrixDecision(hand, name, positionMap);
      for (const decision of decisions) {
        const cell = ensurePreflopMatrixCell(acc, tableSize, decision.scenario, position, decision.facingPosition, classInfo.token);
        if (cell) { cell.total++; cell[decision.action]++; }
      }
    }
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

// Non-rate-stat fields on newPositionStats() that the generic finalizeRate
// loop below has to skip - same idea as PROFIT_FIELD_KEYS, just this
// object's own extra fields (hands count, raw aggression counters).
const POSITION_NON_RATE_KEYS = new Set(['hands', 'aggBets', 'aggCalls']);

function finalizePositionStats(stats) {
  const out = { hands: stats.hands };
  for (const key of Object.keys(stats)) {
    if (PROFIT_FIELD_KEYS.has(key) || POSITION_NON_RATE_KEYS.has(key)) continue;
    out[key] = finalizeRate(stats[key], key);
  }
  // Same aggression-factor definition as the top-level aggFactor
  // (finalize()) - bets+raises per call, null when there's no call data
  // to divide by but bets did happen (an undefined ratio, not a zero one).
  out.aggFactor = stats.aggCalls > 0
    ? Math.round((stats.aggBets / stats.aggCalls) * 100) / 100
    : (stats.aggBets > 0 ? null : 0);
  // Per-position profitability (bb100) - see finalizeProfitLoss above,
  // same currency-safety rule as everywhere else it's used.
  return { ...out, ...finalizeProfitLoss(stats) };
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

function finalizeMatrixCell(cell) {
  return {
    fold: cell.fold,
    call: cell.call,
    raise: cell.raise,
    total: cell.total,
    foldPct: pct(cell.fold, cell.total),
    callPct: pct(cell.call, cell.total),
    raisePct: pct(cell.raise, cell.total),
    // Same reasoning as finalizeVsStat: any single hand-token/position/
    // scenario cell is inherently a small slice of the data, so it always
    // uses the stricter 'rare' confidence profile.
    confidence: getConfidence(cell.total, CONFIDENCE_PROFILES.rare)
  };
}

// preflopMatrix[tableSize].rfi[heroPos][token] or
// preflopMatrix[tableSize].<anyOtherScenario>[heroPos][facingPos][token] -
// see ensurePreflopMatrixCell above for the shape this mirrors.
function finalizePreflopMatrix(preflopMatrix) {
  const out = {};
  for (const tableSize of Object.keys(preflopMatrix)) {
    const sizeBucket = preflopMatrix[tableSize];
    const outSize = {};
    for (const scenario of Object.keys(sizeBucket)) {
      const scenarioBucket = sizeBucket[scenario];
      const outScenario = {};
      for (const heroPos of Object.keys(scenarioBucket)) {
        if (scenario === 'rfi') {
          const outTokens = {};
          for (const token of Object.keys(scenarioBucket[heroPos])) {
            outTokens[token] = finalizeMatrixCell(scenarioBucket[heroPos][token]);
          }
          outScenario[heroPos] = outTokens;
        } else {
          const outFacing = {};
          for (const facingPos of Object.keys(scenarioBucket[heroPos])) {
            const outTokens = {};
            for (const token of Object.keys(scenarioBucket[heroPos][facingPos])) {
              outTokens[token] = finalizeMatrixCell(scenarioBucket[heroPos][facingPos][token]);
            }
            outFacing[facingPos] = outTokens;
          }
          outScenario[heroPos] = outFacing;
        }
      }
      outSize[scenario] = outScenario;
    }
    out[tableSize] = outSize;
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

// Shared by the top-level accumulator and every grouping bucket.
//
// bb100 is NOT currency-guarded: bbUnitsWon is a sum of profitLoss/bb per
// hand, i.e. already dimensionless big blinds by the time it lands in the
// sink (bumpProfit keeps profitLoss and parseBigBlind's `bb` in matching
// units for cents currencies, so the ratio is bb either way). A player
// whose hands span USD, CAD and CHIPS still has one meaningful bb/100 -
// nulling it there hid the metric from anyone with a mixed history.
//
// `currency` stays single-currency-only: it labels the raw
// totalProfitLoss figure, which really is a mixed-unit sum when a slice
// spans currencies, so a null tells the consumer not to print a $ symbol
// it can't justify.
function finalizeProfitLoss(sink) {
  return {
    totalProfitLoss: Math.round(sink.totalProfitLoss * 100) / 100,
    handsWithProfitData: sink.handsWithProfitData,
    bb100: sink.handsWithBbData > 0
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

// byHandClassCategory: a lean profit-only bucket per broad category
// ('pocketPairs', 'axSuited', ...) - no nested breakdown, just the
// top-level "win rate by hand class" figure the Study page charts.
function finalizeHandClassCategoryMap(map) {
  const out = {};
  for (const key of Object.keys(map)) {
    out[key] = { hands: map[key].hands, ...finalizeProfitLoss(map[key]) };
  }
  return out;
}

// byHandClass: one entry per specific 169-hand-class token, each carrying
// its own overall profit figure plus a `contexts` breakdown (preflop
// action type -> profit figure -> per-position profit figure) - the
// three-level drill-down the Study page's hand-class table renders.
function finalizeHandClassMap(map) {
  const out = {};
  for (const token of Object.keys(map)) {
    const bucket = map[token];
    const contexts = {};
    for (const ctxKey of Object.keys(bucket.contexts)) {
      const ctxBucket = bucket.contexts[ctxKey];
      const byPosition = {};
      for (const pos of Object.keys(ctxBucket.byPosition)) {
        byPosition[pos] = { hands: ctxBucket.byPosition[pos].hands, ...finalizeProfitLoss(ctxBucket.byPosition[pos]) };
      }
      contexts[ctxKey] = { hands: ctxBucket.hands, ...finalizeProfitLoss(ctxBucket), byPosition };
    }
    out[token] = { hands: bucket.hands, category: bucket.category, ...finalizeProfitLoss(bucket), contexts };
  }
  return out;
}

// byBoardTexture's per-bucket action-mix (hero's first-flop-street action
// type) -> {count, pct} per type, plus the raw `total` sample size.
function finalizeActionMix(mix) {
  const out = { total: mix.total };
  for (const key of ['bet', 'check', 'raise', 'call', 'fold']) {
    out[key] = { count: mix[key], pct: pct(mix[key], mix.total) };
  }
  return out;
}

// byBoardTexture's bet/raise sizing, as an average fraction of the pot
// (expressed as a percent) - null (not 0) when hero never bet/raised in
// this bucket, same "no data" convention as bb100/currency elsewhere.
function finalizeSizing(sizing) {
  return {
    avgPotPct: sizing.sizingCount > 0 ? Math.round((sizing.sizingSum / sizing.sizingCount) * 1000) / 10 : null,
    sampleSize: sizing.sizingCount
  };
}

// byBoardTexture: one entry per flop-texture tag (see TEXTURE_TAG_KEYS),
// each carrying its own overall profit/action-mix/sizing figures plus a
// `contexts` breakdown (preflop action -> same figures -> a `handClasses`
// breakdown of which starting hands hero was doing this with) - the
// three-level drill-down the Study page's Board Texture table renders.
// Structurally mirrors finalizeHandClassMap above, reshuffled (tag is the
// top level here instead of hand-class token).
function finalizeBoardTextureMap(map) {
  const out = {};
  for (const tag of Object.keys(map)) {
    const bucket = map[tag];
    const contexts = {};
    for (const ctxKey of Object.keys(bucket.contexts)) {
      const ctxBucket = bucket.contexts[ctxKey];
      const handClasses = {};
      for (const token of Object.keys(ctxBucket.handClasses)) {
        handClasses[token] = { hands: ctxBucket.handClasses[token].hands, ...finalizeProfitLoss(ctxBucket.handClasses[token]) };
      }
      contexts[ctxKey] = {
        hands: ctxBucket.hands,
        ...finalizeProfitLoss(ctxBucket),
        actionMix: finalizeActionMix(ctxBucket.actionMix),
        sizing: finalizeSizing(ctxBucket.sizing),
        handClasses
      };
    }
    out[tag] = {
      hands: bucket.hands,
      ...finalizeProfitLoss(bucket),
      actionMix: finalizeActionMix(bucket.actionMix),
      sizing: finalizeSizing(bucket.sizing),
      contexts
    };
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
  'cbTurn', 'cbRiver', 'donk', 'probe',
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
    // totalProfitLoss/bb100/currency: see finalizeProfitLoss above for
    // which of these survive a slice that mixes currencies (e.g. a
    // real-money site + a play-chip home game) and which go null.
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
    // Flop-texture-tag breakdown - tag ('monotone'|'twoTone'|'rainbow'|
    // 'paired'|'trips'|'connected'|'acehigh') -> { hands, totalProfitLoss,
    // bb100, currency, actionMix, sizing, contexts: { <preflop context> ->
    // same shape one level deeper, plus handClasses: { <169-hand-class
    // token> -> {hands, totalProfitLoss, bb100, currency} } } }. See
    // finalizeBoardTextureMap above and flopTexture.js's classifyFlopTexture.
    byBoardTexture: finalizeBoardTextureMap(acc.byBoardTexture),
    // { wonNoShowdown, wonAtShowdown, lostNoShowdown, lostAtShowdown } -
    // hand-wide counts (see newShowdownBreakdown() above), raw counts not
    // percentages since the Study page donut wants relative slice sizes.
    showdownBreakdown: acc.showdownBreakdown,
    // Win rate by starting hand - see handClass.js/classifyHeroPreflopContext
    // above. byHandClassCategory is the flat "Pocket pairs +18.4bb/100"
    // summary; byHandClass drills into individual hands, each further split
    // by preflop context (open/3bet/4bet/...) and then by position.
    byHandClassCategory: finalizeHandClassCategoryMap(acc.byHandClassCategory),
    byHandClass: finalizeHandClassMap(acc.byHandClass),
    // Range-matrix grid for the Study page's "Range Matrix" subpage - see
    // ensurePreflopMatrixCell/classifyHeroPreflopMatrixDecision above.
    preflopMatrix: finalizePreflopMatrix(acc.preflopMatrix),
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
