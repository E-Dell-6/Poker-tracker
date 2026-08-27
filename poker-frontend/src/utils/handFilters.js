// Hand-level filter predicates shared between the per-session filter bar
// (SessionLog.jsx) and the cross-session hand search menu
// (HandSearchMenu.jsx), so "3-Bet" etc. means the same thing in both
// places. None of this cares how many hole cards the hero was dealt, so
// it applies to PLO hands the same way it applies to NLH hands.

export const HAND_FILTERS = [
  { key: "flop",  label: "Saw Flop" },
  { key: "allin", label: "All-In"   },
  { key: "3bet",  label: "3-Bet"    },
  { key: "4bet",  label: "4-Bet"    },
  { key: "5bet",  label: "5-Bet"    },
  { key: "6bet",  label: "6-Bet"    },
];

export function sawFlop(hand) {
  return hand.board?.flop?.length > 0;
}

export function hadAllIn(hand) {
  if (hand.hasAllIn || hand.allIn) return true;

  const players = hand.players ?? [];
  for (const p of players) {
    if (p.winnings > 0 && p.winnings > p.stack) return true;
  }

  const actions = hand.actions ?? [];
  for (const a of actions) {
    if (a.actionType === "RAISE" || a.actionType === "CALL" || a.actionType === "BET") {
      const player = players.find(p => p.name === a.player);
      if (player && a.amount >= player.stack) return true;
    }
  }

  return false;
}

export function countPreflopRaises(hand) {
  return (hand.actions ?? []).filter(
    a => a.street === "PREFLOP" && a.actionType === "RAISE"
  ).length;
}

export function handMatchesFilter(hand, filter) {
  switch (filter) {
    case "flop":  return sawFlop(hand);
    case "allin": return hadAllIn(hand);
    case "3bet":  return countPreflopRaises(hand) >= 2;
    case "4bet":  return countPreflopRaises(hand) >= 3;
    case "5bet":  return countPreflopRaises(hand) >= 4;
    case "6bet":  return countPreflopRaises(hand) >= 5;
    default:      return true;
  }
}

export function getAvailableFilters(hands) {
  return HAND_FILTERS.filter(f => hands.some(h => handMatchesFilter(h, f.key)));
}