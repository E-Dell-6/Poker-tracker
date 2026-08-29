// Shared action-replay primitive for anything that needs mid-hand state
// (who's invested how much, at what point) rather than just the final
// totals handProfitCalculator.js computes. Mirrors that file's exact
// invested/streetBets bookkeeping - same convention, just exposed as a
// step-by-step generator instead of a final-totals-only function, so
// allInDetector.js (this pass) and evCalculator.js (item 4d) don't each
// reimplement the replay loop.
export function* replayActions(hand) {
  const invested = {};
  let streetBets = {};
  let lastStreet = null;

  for (const action of hand.actions ?? []) {
    if (action.street !== lastStreet) {
      streetBets = {};
      lastStreet = action.street;
    }
    const name = action.player;
    if (!name) continue;
    const amount = Number(action.amount) || 0;
    const previousBet = streetBets[name] || 0;

    switch (action.actionType) {
      case 'POST_SB':
      case 'POST_BB':
        streetBets[name] = amount;
        invested[name] = (invested[name] || 0) + amount;
        break;
      case 'BET':
      case 'RAISE': {
        const add = amount - previousBet;
        streetBets[name] = amount;
        invested[name] = (invested[name] || 0) + add;
        break;
      }
      case 'CALL':
        streetBets[name] = previousBet + amount;
        invested[name] = (invested[name] || 0) + amount;
        break;
      default:
        break; // FOLD / CHECK / SHOW_HAND / MUCK move no chips
    }

    // `invested` is yielded by reference and mutated in place on the next
    // iteration - callers that need a snapshot at this exact step should
    // copy it (e.g. `{ ...invested }`), not hold onto the reference.
    yield { action, invested };
  }
}
