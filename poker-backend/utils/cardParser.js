// Standalone card-string parsing, independent of any stats logic. Cards
// are stored throughout this codebase as 2-char strings, rank first suit
// second, lowercase suit letter, 'T' for ten (see CardSelector.jsx's
// comment and PokerHands.js's holeCards/board fields): "Ah", "Td", "9c".

const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

// { rank, suit } - rank is numeric (2-14, T/J/Q/K/A -> 10-14) so callers
// can do gap/spread arithmetic directly instead of re-parsing a letter;
// suit stays the existing lowercase-letter convention ('s'|'h'|'d'|'c').
export function parseCard(str) {
  const s = String(str || '').trim();
  if (s.length !== 2) throw new Error(`Invalid card string: "${str}"`);

  const rankChar = s[0].toUpperCase();
  const suit = s[1].toLowerCase();
  const rank = RANK_VALUES[rankChar];
  if (!rank) throw new Error(`Invalid card rank in "${str}"`);
  if (!'shdc'.includes(suit)) throw new Error(`Invalid card suit in "${str}"`);

  return { rank, suit };
}

export function parseBoard(cards) {
  return (cards || []).map(parseCard);
}
