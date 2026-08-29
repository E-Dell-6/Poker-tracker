import { replayActions } from './handReplay.js';

// Sets hand.isAllIn: true the moment any action's replay shows a player's
// remaining stack (starting stack - cumulative invested) hit 0, with
// action still possibly pending elsewhere (this doesn't require it to be
// the hand's last action). No currency dependency - unlike
// effectiveStackCalculator.js, stack and action amounts are already in the
// same unit for a given hand, so this is safe to run at parse time.
//
// `false` is only ever set when every active player's starting stack is
// actually known and no all-in was found - otherwise (a sitting-out/
// legacy import with a missing stack) isAllIn stays `null` (unknown).
// Coercing a missing-data case to `false` would be a data-integrity bug,
// not a missing value - a real all-in involving the player with unknown
// stack would then be silently invisible to item 4d's EV computation.
export function detectAllIn(hand) {
  const active = (hand.players || []).filter(p => !p.isSittingOut);
  const hasCompleteStackData = active.every(p => typeof p.stack === 'number');
  const playerByName = new Map(active.map(p => [p.name, p]));

  let anyAllIn = false;
  for (const { action, invested } of replayActions(hand)) {
    const player = playerByName.get(action.player);
    if (!player || typeof player.stack !== 'number') continue;

    const remaining = player.stack - (invested[action.player] || 0);
    if (remaining <= 0) anyAllIn = true;
  }

  hand.isAllIn = anyAllIn ? true : (hasCompleteStackData ? false : null);
  return hand.isAllIn;
}
