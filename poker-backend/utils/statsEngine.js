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
function getPositionMap(hand) {
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
    currencies: new Set()
  };
}

function accumulatePreflop(hand, positionMap, name, acc) {
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
          if (a.actionType === 'RAISE' || a.actionType === 'BET') {
            acc.open.made++;
            if (onlyPassiveSoFar && STEAL_POSITIONS.includes(position)) {
              acc.steal.opportunities++;
              acc.steal.made++;
            }
          } else if (a.actionType === 'CALL') {
            acc.limp.opportunities++;
            acc.limp.made++;
          }
        } else if (level === 1) {
          const openerPos = raiserPositionAtLevel[1];
          const openWasSteal = STEAL_POSITIONS.includes(openerPos);
          acc.threeBet.opportunities++;
          if (openWasSteal && BLIND_POSITIONS.includes(position)) acc.foldToSteal.opportunities++;

          if (a.actionType === 'RAISE') {
            acc.threeBet.made++;
          } else if (a.actionType === 'FOLD') {
            if (openWasSteal && BLIND_POSITIONS.includes(position)) acc.foldToSteal.made++;
          } else if (a.actionType === 'CALL' && !playerHasVpipd) {
            acc.coldCall.opportunities++;
            acc.coldCall.made++;
          }
        } else if (level === 2) {
          acc.fourBet.opportunities++;
          acc.foldTo3Bet.opportunities++;
          if (a.actionType === 'RAISE') acc.fourBet.made++;
          else if (a.actionType === 'FOLD') acc.foldTo3Bet.made++;
          else if (a.actionType === 'CALL' && !playerHasVpipd) {
            acc.coldCall.opportunities++;
            acc.coldCall.made++;
          }
        } else if (level === 3) {
          acc.foldTo4Bet.opportunities++;
          if (a.actionType === 'FOLD') acc.foldTo4Bet.made++;
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
  if (playerHasVpipd) acc.vpip.made++;
  acc.pfr.opportunities++;
  if (playerHasRaised) acc.pfr.made++;

  return { sawFlop: !real.some(a => a.player === name && a.actionType === 'FOLD') };
}

function accumulatePostflop(hand, name, wasPreflopAggressor, acc) {
  const streets = ['FLOP', 'TURN', 'RIVER'];
  let cbTracked = false; // only count cbFlop/foldToCbFlop opportunity once
  let stillIn = true;

  for (const street of streets) {
    const streetActions = (hand.actions || []).filter(a => a.street === street);
    if (streetActions.length === 0) continue;

    let hasCheckedThisStreet = false;
    let firstActorIsAggressor = wasPreflopAggressor && street === 'FLOP';

    for (let i = 0; i < streetActions.length; i++) {
      const a = streetActions[i];
      const isPlayer = a.player === name;

      if (street === 'FLOP' && !cbTracked && wasPreflopAggressor) {
        cbTracked = true;
        acc.cbFlop.opportunities++;
        const firstAction = streetActions[0];
        if (firstAction.player === name && (firstAction.actionType === 'BET' || firstAction.actionType === 'RAISE')) {
          acc.cbFlop.made++;
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
        }
      }
    }
  }

  return stillIn;
}

function accumulateShowdown(hand, name, sawFlop, stillInAfterPostflop, isWinner, acc) {
  const hadShowdown = (hand.actions || []).some(
    a => a.actionType === 'SHOW_HAND' || a.actionType === 'MUCK'
  );

  if (sawFlop) {
    acc.wwsf.opportunities++;
    if (isWinner) acc.wwsf.made++;

    // wtsd opportunity = every hand where the player saw the flop and
    // was still in the hand postflop. wtsd made = the subset that
    // actually reached showdown. These must NOT be incremented in the
    // same branch, or the rate is trivially always 100%.
    if (stillInAfterPostflop) {
      acc.wtsd.opportunities++;
      if (hadShowdown) {
        acc.wtsd.made++;
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

    const { sawFlop } = accumulatePreflop(hand, positionMap, name, acc);

    let stillIn = true;
    if (sawFlop && hand.board?.flop?.length) {
      const wasPreflopAggressor = (hand.actions || [])
        .filter(a => a.street === 'PREFLOP' && (a.actionType === 'RAISE' || a.actionType === 'BET'))
        .slice(-1)[0]?.player === name;
      stillIn = accumulatePostflop(hand, name, wasPreflopAggressor, acc);
    }

    const isWinner = (hand.winners || []).includes(name);
    accumulateShowdown(hand, name, sawFlop && hand.board?.flop?.length > 0, stillIn, isWinner, acc);

    if (typeof player.profitLoss === 'number') {
      acc.totalProfitLoss += player.profitLoss;
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
    currency: acc.currencies.size === 1 ? [...acc.currencies][0] : null
  };
}

// Matcher helpers so callers don't have to hand-roll the comparison.
export const matchByPersonId = personId => (p) => p.personId && String(p.personId) === String(personId);
export const matchHero = () => (p) => p.isHero === true;