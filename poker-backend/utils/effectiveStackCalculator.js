import { parseBigBlind } from './blinds.js';

// Effective stack (in big blinds) at the start of a hand, per player:
// min(this player's stack, the largest stack among the OTHER active
// players) / bb-size. This is a hand-start-only figure - it does not need
// action replay, unlike profitLoss/isAllIn which track chips moving
// mid-hand. Mirrors computeHandProfits' convention of mutating the hand's
// player list in place and getting called once at parse time.
export function computeEffectiveStacks(hand) {
  const bb = parseBigBlind(hand.stakes, hand.currency);
  const active = (hand.players || []).filter(p => !p.isSittingOut && typeof p.stack === 'number');

  for (const player of hand.players || []) {
    player.effectiveStackBB = null;
    if (player.isSittingOut || typeof player.stack !== 'number' || !bb) continue;

    const others = active.filter(p => p !== player);
    if (others.length === 0) continue;

    const largestOpponentStack = Math.max(...others.map(p => p.stack));
    player.effectiveStackBB = Math.min(player.stack, largestOpponentStack) / bb;
  }
}
