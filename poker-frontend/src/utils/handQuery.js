// Classifies a raw typed search-bar string into a search intent: a
// shorthand hand-class (pocket pair or suited/offsuit, e.g. "AA"/"ATo"),
// an exact two-card query (e.g. "7h8h"), or a player-name free-text
// search. Card/rank conventions match cardParser.js and handClass.js's
// token format (uppercase ranks, T for ten, lowercase suit/suffix).

const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'shdc';
const RANK_ORDER = Object.fromEntries([...RANK_CHARS].map((r, i) => [r, i]));

function isRank(ch) {
  return RANK_CHARS.includes(ch.toUpperCase());
}

function isSuit(ch) {
  return SUIT_CHARS.includes(ch.toLowerCase());
}

// -> null | {type:'handClass', token} | {type:'literalCards', cards} | {type:'playerName', query}
export function parseHandQuery(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  // Pocket pair: two identical rank characters, e.g. "aa", "88".
  if (trimmed.length === 2 && isRank(trimmed[0]) && trimmed[0].toUpperCase() === trimmed[1].toUpperCase()) {
    const rank = trimmed[0].toUpperCase();
    return { type: 'handClass', token: `${rank}${rank}` };
  }

  // Suited/offsuit class: two distinct ranks + s/o suffix, e.g. "ATo", "A9s".
  if (trimmed.length === 3 && isRank(trimmed[0]) && isRank(trimmed[1]) && /[so]/i.test(trimmed[2])) {
    const r1 = trimmed[0].toUpperCase();
    const r2 = trimmed[1].toUpperCase();
    if (r1 !== r2) {
      const [hi, lo] = RANK_ORDER[r1] >= RANK_ORDER[r2] ? [r1, r2] : [r2, r1];
      return { type: 'handClass', token: `${hi}${lo}${trimmed[2].toLowerCase()}` };
    }
  }

  // Literal two cards: two rank+suit chunks, e.g. "7h8h".
  if (trimmed.length === 4) {
    const [r1, s1, r2, s2] = trimmed;
    if (isRank(r1) && isSuit(s1) && isRank(r2) && isSuit(s2)) {
      const card1 = `${r1.toUpperCase()}${s1.toLowerCase()}`;
      const card2 = `${r2.toUpperCase()}${s2.toLowerCase()}`;
      if (card1 !== card2) {
        return { type: 'literalCards', cards: [card1, card2] };
      }
    }
  }

  return { type: 'playerName', query: trimmed };
}
