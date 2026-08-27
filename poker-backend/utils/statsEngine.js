// Generalized (non-heads-up-only) player stats engine.
// Takes an array of Hand documents + a matcher function that picks the
// target player's entry out of hand.players, and returns one stats object.
// Used both for opponents (match by personId) and hero (match by isHero).

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

// Sessions logged in these currencies store profitLoss (and all other
// dollar amounts) in integer CENTS (see ACRPokerParser.js). `stakes` is
// always the raw display string (e.g. "$1/$2"), i.e. major units - so the
// parsed bb figure has to be scaled up to match profitLoss's units before
// the two are ever divided together, or bb100 comes out ~100x too large.
const CENTS_CURRENCIES = new Set(['USD', 'CAD']);

function parseBigBlind(stakes, currency) {
  if (!stakes) return null;
  const parts = String(stakes).split('/').map(s => parseFloat(s.replace(/[^0-9.]/g, '')));
  const bb = parts[parts.length - 1];
  if (!Number.isFinite(bb) || bb <= 0) return null;
  return CENTS_CURRENCIES.has(currency) ? bb * 100 : bb;
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
function accumulatePreflop(hand, positionMap, name, acc, posBucket, posStats) {
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
          acc.open.opportunities++;
          if (posStats) posStats.open.opportunities++;
          if (a.actionType === 'RAISE' || a.actionType === 'BET') {
            acc.open.made++;
            if (posStats) posStats.open.made++;
            if (onlyPassiveSoFar && STEAL_POSITIONS.includes(position)) {
              acc.steal.opportunities++;
              acc.steal.made++;
              if (posStats) {
                posStats.steal.opportunities++;
                posStats.steal.made++;
              }
            }
          } else if (a.actionType === 'CALL') {
            acc.limp.opportunities++;
            acc.limp.made++;
          }
        } else if (level === 1) {
          // This is the "facing an open" moment: raiserPositionAtLevel[1]
          // is whoever made it 2 bets to go.
          const openerPos = raiserPositionAtLevel[1];
          const openWasSteal = STEAL_POSITIONS.includes(openerPos);
          acc.threeBet.opportunities++;
          if (posStats) posStats.threeBet.opportunities++;
          if (openWasSteal && BLIND_POSITIONS.includes(position)) acc.foldToSteal.opportunities++;

          if (a.actionType === 'RAISE') {
            acc.threeBet.made++;
            if (posStats) posStats.threeBet.made++;
          } else if (a.actionType === 'FOLD') {
            if (openWasSteal && BLIND_POSITIONS.includes(position)) acc.foldToSteal.made++;
          } else if (a.actionType === 'CALL' && !playerHasVpipd) {
            acc.coldCall.opportunities++;
            acc.coldCall.made++;
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
          acc.fourBet.opportunities++;
          acc.foldTo3Bet.opportunities++;
          if (posStats) {
            posStats.fourBet.opportunities++;
            posStats.foldTo3Bet.opportunities++;
          }
          if (a.actionType === 'RAISE') {
            acc.fourBet.made++;
            if (posStats) posStats.fourBet.made++;
          } else if (a.actionType === 'FOLD') {
            acc.foldTo3Bet.made++;
            if (posStats) posStats.foldTo3Bet.made++;
          } else if (a.actionType === 'CALL' && !playerHasVpipd) {
            acc.coldCall.opportunities++;
            acc.coldCall.made++;
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
          acc.foldTo4Bet.opportunities++;
          if (posStats) posStats.foldTo4Bet.opportunities++;
          if (a.actionType === 'FOLD') {
            acc.foldTo4Bet.made++;
            if (posStats) posStats.foldTo4Bet.made++;
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

  acc.vpip.opportunities++;
  if (posStats) posStats.vpip.opportunities++;
  if (playerHasVpipd) {
    acc.vpip.made++;
    if (posStats) posStats.vpip.made++;
  }
  acc.pfr.opportunities++;
  if (posStats) posStats.pfr.opportunities++;
  if (playerHasRaised) {
    acc.pfr.made++;
    if (posStats) posStats.pfr.made++;
  }

  return { sawFlop: !real.some(a => a.player === name && a.actionType === 'FOLD') };
}

function accumulatePostflop(hand, name, wasPreflopAggressor, acc, posStats) {
  const streets = ['FLOP', 'TURN', 'RIVER'];
  let cbTracked = false; // only count cbFlop/foldToCbFlop opportunity once
  let stillIn = true;

  for (const street of streets) {
    const streetActions = (hand.actions || []).filter(a => a.street === street);
    if (streetActions.length === 0) continue;

    let hasCheckedThisStreet = false;

    for (let i = 0; i < streetActions.length; i++) {
      const a = streetActions[i];
      const isPlayer = a.player === name;

      if (street === 'FLOP' && !cbTracked && wasPreflopAggressor) {
        cbTracked = true;
        acc.cbFlop.opportunities++;
        if (posStats) posStats.cbFlop.opportunities++;
        const firstAction = streetActions[0];
        if (firstAction.player === name && (firstAction.actionType === 'BET' || firstAction.actionType === 'RAISE')) {
          acc.cbFlop.made++;
          if (posStats) posStats.cbFlop.made++;
        }
      }

      if (isPlayer) {
        if (a.actionType === 'FOLD') {
          stillIn = false;
          // folding to a cbet: the first action this street was a bet, not by us, and this is our first response
          if (street === 'FLOP' && wasPreflopAggressor === false && i > 0) {
            const priorBet = streetActions.slice(0, i).find(x => x.actionType === 'BET' || x.actionType === 'RAISE');
            if (priorBet && streetActions[0].actionType === 'BET') {
              acc.foldToCbFlop.made++;
              if (posStats) posStats.foldToCbFlop.made++;
            }
          }
        }
        if (a.actionType === 'CHECK') hasCheckedThisStreet = true;
        if (a.actionType === 'RAISE' && hasCheckedThisStreet) acc.checkRaise.opportunities++, acc.checkRaise.made++;
        if (a.actionType === 'BET' || a.actionType === 'RAISE') acc.aggBets++;
        if (a.actionType === 'CALL') acc.aggCalls++;
      }
    }

    // foldToCbFlop opportunity: we faced a flop bet from the preflop aggressor as our first action
    if (street === 'FLOP' && !wasPreflopAggressor) {
      const firstAction = streetActions[0];
      if (firstAction && (firstAction.actionType === 'BET')) {
        const ourFirstResponse = streetActions.find(a => a.player === name);
        if (ourFirstResponse) {
          acc.foldToCbFlop.opportunities++;
          if (posStats) posStats.foldToCbFlop.opportunities++;
        }
      }
    }
  }

  return stillIn;
}

function accumulateShowdown(hand, name, sawFlop, stillInAfterPostflop, isWinner, acc, posStats) {
  const hadShowdown = (hand.actions || []).some(
    a => a.actionType === 'SHOW_HAND' || a.actionType === 'MUCK'
  );

  if (sawFlop) {
    acc.wwsf.opportunities++;
    if (posStats) posStats.wwsf.opportunities++;
    if (isWinner) {
      acc.wwsf.made++;
      if (posStats) posStats.wwsf.made++;
    }

    // wtsd opportunity = every hand where the player saw the flop and
    // was still in the hand postflop. wtsd made = the subset that
    // actually reached showdown. These must NOT be incremented in the
    // same branch, or the rate is trivially always 100%.
    if (stillInAfterPostflop) {
      acc.wtsd.opportunities++;
      if (posStats) posStats.wtsd.opportunities++;
      if (hadShowdown) {
        acc.wtsd.made++;
        if (posStats) posStats.wtsd.made++;
        acc.wsd.opportunities++;
        if (isWinner) acc.wsd.made++;
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
    if (hand.currency) acc.currencies.add(hand.currency);
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

    const { sawFlop } = accumulatePreflop(hand, positionMap, name, acc, posBucket, posStats);

    let stillIn = true;
    if (sawFlop && hand.board?.flop?.length) {
      const wasPreflopAggressor = (hand.actions || [])
        .filter(a => a.street === 'PREFLOP' && (a.actionType === 'RAISE' || a.actionType === 'BET'))
        .slice(-1)[0]?.player === name;
      stillIn = accumulatePostflop(hand, name, wasPreflopAggressor, acc, posStats);
    }

    const isWinner = (hand.winners || []).includes(name);
    accumulateShowdown(hand, name, sawFlop && hand.board?.flop?.length > 0, stillIn, isWinner, acc, posStats);

    if (typeof player.profitLoss === 'number') {
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
      acc.totalProfitLoss += displayProfit;
      acc.handsWithProfitData++;

      const bb = parseBigBlind(hand.stakes, hand.currency);
      if (bb) {
        acc.bbUnitsWon += player.profitLoss / bb;
        acc.handsWithBbData++;
      }
    }
  }

  return finalize(acc);
}

function pct(made, opportunities) {
  return opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0;
}

function finalizeRate(rate) {
  return { pct: pct(rate.made, rate.opportunities), made: rate.made, opportunities: rate.opportunities };
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
    defendPct: pct(stat.called + stat.raised, faced)
  };
}

function finalizePositionStats(stats) {
  const out = {};
  for (const key of Object.keys(stats)) {
    out[key] = finalizeRate(stats[key]);
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

function finalize(acc) {
  const aggPct = (acc.aggBets + acc.aggCalls) > 0
    ? Math.round((acc.aggBets / (acc.aggBets + acc.aggCalls)) * 1000) / 10
    : 0;
  const aggFactor = acc.aggCalls > 0 ? Math.round((acc.aggBets / acc.aggCalls) * 100) / 100 : acc.aggBets > 0 ? null : 0;

  return {
    totalHands: acc.hands,
    vpip: finalizeRate(acc.vpip),
    pfr: finalizeRate(acc.pfr),
    open: finalizeRate(acc.open),
    threeBet: finalizeRate(acc.threeBet),
    foldTo3Bet: finalizeRate(acc.foldTo3Bet),
    fourBet: finalizeRate(acc.fourBet),
    foldTo4Bet: finalizeRate(acc.foldTo4Bet),
    steal: finalizeRate(acc.steal),
    foldToSteal: finalizeRate(acc.foldToSteal),
    limp: finalizeRate(acc.limp),
    coldCall: finalizeRate(acc.coldCall),
    cbFlop: finalizeRate(acc.cbFlop),
    foldToCbFlop: finalizeRate(acc.foldToCbFlop),
    checkRaise: finalizeRate(acc.checkRaise),
    wtsd: finalizeRate(acc.wtsd),
    wsd: finalizeRate(acc.wsd),
    wwsf: finalizeRate(acc.wwsf),
    aggPct,
    aggFactor,
    totalProfitLoss: Math.round(acc.totalProfitLoss * 100) / 100,
    handsWithProfitData: acc.handsWithProfitData,
    bb100: (acc.handsWithBbData > 0 && acc.currencies.size <= 1)
      ? Math.round((acc.bbUnitsWon / acc.handsWithBbData) * 100 * 100) / 100
      : null,
    // Single currency string if every hand for this player was in the
    // same currency, otherwise null. totalProfitLoss/bb100 mix units
    // whenever a player's hands span multiple currencies (e.g. a real-
    // money site + a play-chip home game) - there's no single scalar
    // that's meaningful in that case, so callers get an explicit null
    // instead of a silently-wrong number, and should decide how to
    // handle/display that (e.g. split stats per currency).
    currency: acc.currencies.size === 1 ? [...acc.currencies][0] : null,
    // Position-vs-position breakdown, bucketed by table size (2-9 active
    // players). See ensurePositional/ensureVsOpen/ensureVs3Bet above for
    // the shape. Keys are stringified table sizes ("6", "9", ...) because
    // that's what plain-object/JSON round-tripping gives us.
    positional: finalizePositional(acc.positional),
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