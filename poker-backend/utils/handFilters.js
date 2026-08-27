// Hand-level filter predicates shared by the /api/hands/search route.
// Mirrors SessionLog.jsx's per-session filter bar on the frontend exactly,
// so "3-Bet" (etc.) means the same thing whether you're filtering hands
// inside one expanded session or searching across all of them. None of
// these care how many hole cards the hero was dealt, so they apply to
// PLO hands the same way they apply to NLH hands.

export function sawFlop(hand) {
    return (hand.board?.flop?.length ?? 0) > 0;
}

export function hadAllIn(hand) {
    if (hand.hasAllIn || hand.allIn) return true;

    const players = hand.players ?? [];
    for (const p of players) {
        if (p.winnings > 0 && p.winnings > p.stack) return true;
    }

    const actions = hand.actions ?? [];
    for (const a of actions) {
        if (a.actionType === 'RAISE' || a.actionType === 'CALL' || a.actionType === 'BET') {
            const player = players.find(p => p.name === a.player);
            if (player && a.amount >= player.stack) return true;
        }
    }

    return false;
}

export function countPreflopRaises(hand) {
    return (hand.actions ?? []).filter(
        a => a.street === 'PREFLOP' && a.actionType === 'RAISE'
    ).length;
}

export function handMatchesFilter(hand, filter) {
    switch (filter) {
        case 'flop':  return sawFlop(hand);
        case 'allin': return hadAllIn(hand);
        case '3bet':  return countPreflopRaises(hand) >= 2;
        case '4bet':  return countPreflopRaises(hand) >= 3;
        case '5bet':  return countPreflopRaises(hand) >= 4;
        case '6bet':  return countPreflopRaises(hand) >= 5;
        default:      return true;
    }
}