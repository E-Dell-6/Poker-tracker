import { replayActions } from './handReplay.js';
import { simulateEquity } from './equityEngine.js';

// Computes hero's all-in EV for a hand already flagged isAllIn=true by
// allInDetector.js: at the point the all-in happened, what was hero's
// equity-weighted expected profit, versus what actually happened
// (hand.players[hero].profitLoss)? The gap between the two - plotted over
// many hands (item 4e) - is the luck-adjusted variance line trackers like
// this usually call an "EV graph".
//
// Explicitly scoped to the case that's actually answerable from known
// cards alone - see the module-level TODO below for what's deliberately
// left out. Returns `null` (not a wrong number) whenever any of these
// don't hold, rather than guessing:
//   - hero wasn't part of the hand, or her hole cards aren't known (PLO's
//     4 hole cards are out of scope too - evaluateHand only handles 2-7
//     total cards, i.e. NLH's 2 hole + up to 5 board)
//   - no all-in is actually replayable from stack/action data
//   - a side pot would have formed (a BET/RAISE happens after the all-in
//     point) - a side pot needs its own separate equity calc per pot,
//     not attempted this pass
//   - fewer than 2 players are still live by the end of the hand (hero
//     just won an uncontested pot - no variance to adjust for) or hero
//     isn't among them
//   - any other still-live participant's hole cards were never revealed
//     (showedHand) - without them there's nothing to run equity against
//     except a guessed range, which is exactly the harder problem this
//     pass isn't attempting
export function computeAllInEV(hand) {
  if (hand.isAllIn !== true) return null;

  const players = hand.players || [];
  const hero = players.find(p => p.isHero);
  if (!hero || !hero.holeCards || hero.holeCards.length !== 2) return null;

  const actions = hand.actions || [];
  const playerByName = new Map(players.map(p => [p.name, p]));

  // Find the all-in trigger: the first action whose replay shows the
  // acting player's remaining stack hit 0 - same detection rule
  // allInDetector.js uses, but this time we need to know exactly WHERE
  // (index/street), not just that it happened somewhere.
  let triggerIndex = -1;
  let finalInvested = {};
  let i = 0;
  for (const { action, invested } of replayActions(hand)) {
    finalInvested = invested; // same mutated object each yield - valid once the loop finishes
    if (triggerIndex === -1) {
      const player = playerByName.get(action.player);
      if (player && typeof player.stack === 'number' && player.stack - (invested[action.player] || 0) <= 0) {
        triggerIndex = i;
      }
    }
    i++;
  }
  if (triggerIndex === -1) return null; // isAllIn was true but not replayable here (e.g. stack data since removed)

  // No-side-pot guard: if anyone bets/raises after the trigger, a side
  // pot forms (chips beyond the all-in player's stack are only contested
  // among the players who can still cover them) - that needs a separate
  // equity calc per pot, not this single-pot formula.
  for (let j = triggerIndex + 1; j < actions.length; j++) {
    if (actions[j].actionType === 'BET' || actions[j].actionType === 'RAISE') return null;
  }

  const folded = new Set();
  for (let j = triggerIndex; j < actions.length; j++) {
    if (actions[j].actionType === 'FOLD') folded.add(actions[j].player);
  }
  const participants = players.filter(p => !p.isSittingOut && !folded.has(p.name));
  if (participants.length < 2 || !participants.some(p => p.isHero)) return null;

  // Hero's own cards are always known when she's dealt in (holeCards);
  // an opponent's are only known if they showed at showdown (showedHand) -
  // a folded-but-technically-still-invested player never reveals theirs,
  // and a losing all-in player can muck without showing either.
  const cardsByParticipant = participants.map(p => ({
    player: p,
    cards: p.isHero ? p.holeCards : (p.showedHand?.length === 2 ? p.showedHand : null)
  }));
  if (cardsByParticipant.some(c => !c.cards || c.cards.length !== 2)) return null;

  // board.flop/turn/river are each already CUMULATIVE (3/4/5 cards - both
  // parsers store the whole board-to-date at each street, not just that
  // street's new card; HandReplayer.jsx relies on this same shape,
  // reading hand.board.turn/river directly with no concatenation), so
  // picking the right field IS the reconstruction - no combining needed.
  const triggerStreet = actions[triggerIndex].street;
  // The board AS IT STOOD at the all-in moment, not the final board - EV
  // has to be computed going into the runout, not after seeing how it
  // actually came out (that's just profitLoss again).
  const knownBoard =
    triggerStreet === 'PREFLOP' ? [] :
    triggerStreet === 'FLOP' ? (hand.board?.flop || []) :
    triggerStreet === 'TURN' ? (hand.board?.turn || []) :
    (hand.board?.river || []);

  // potAtAllIn is the sum of every player's total investment (including
  // anyone who folded earlier - their forfeited chips are still part of
  // the pot), computed from the SAME replay `invested` totals as
  // heroInvested below - not from ActionSchema.potSizeAfter. That field
  // turned out to be unreliable for this: ACRPokerParser.js's
  // parseACRAction adds a RAISE's full "raise to" total on top of a
  // prevPot that can already include that same player's own earlier
  // contribution (a posted blind, or an earlier bet this street),
  // double-counting it - caught by this module's own end-to-end
  // regression test (evPipeline.e2e.test.js) coming out ~$5 high on a
  // hand where the raiser had already posted the small blind. That's a
  // pre-existing bug in the parser worth fixing separately (it likely
  // also affects pot sizes shown during hand replay) - not attempted
  // here, but summing `invested` directly sidesteps it for this
  // computation regardless of whether/when it gets fixed upstream.
  const potAtAllIn = Object.values(finalInvested).reduce((sum, v) => sum + v, 0);
  const equities = simulateEquity(cardsByParticipant.map(c => c.cards), knownBoard);
  const heroIdx = cardsByParticipant.findIndex(c => c.player.isHero);

  // heroInvested is hero's TOTAL investment across the whole hand - the
  // same quantity handProfitCalculator.js's `invested` uses for
  // profitLoss (winnings - invested), not just the chips put in after the
  // trigger. Using the same base keeps allInEV directly comparable to
  // profitLoss for the item 4e graph: allInEV - profitLoss = equity*pot -
  // actualWinnings, the luck-adjusted delta the graph is built to show.
  // Same raw unit as profitLoss/stack/action.amount for this hand (cents
  // for USD/CAD, plain units for CHIPS) - no currency conversion needed
  // here, unlike effectiveStackCalculator.js, since every quantity above
  // comes from the same hand's own already-consistent units.
  const heroInvested = finalInvested[hero.name] || 0;

  return equities[heroIdx] * potAtAllIn - heroInvested;
}

// TODO(range-ev): showdown-without-all-in EV (a hand that reached
// showdown normally, no one ever all-in) and non-showdown EV (a folded
// pot, or an all-in where an opponent's cards were never revealed) both
// require modeling or approximating an opponent's holding/range rather
// than reading known cards off the hand history - a meaningfully harder
// problem than computeAllInEV above, which only ever needs cards that are
// already on the record. Not attempted this pass. A future
// rangeAdjustedEV(hand) implementing either case should return the same
// shape (a number, or null when it can't be computed) so item 4e's graph
// endpoint doesn't need to change to consume it - only the `evResult =
// hand.allInEV ?? actualResult` fallback would gain another source ahead
// of the actualResult fallback.
