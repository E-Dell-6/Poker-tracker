import { describe, it, expect } from 'vitest';
import { parseCard, parseBoard } from '../utils/cardParser.js';

describe('parseCard', () => {
  it('parses number ranks', () => {
    expect(parseCard('2c')).toEqual({ rank: 2, suit: 'c' });
    expect(parseCard('9h')).toEqual({ rank: 9, suit: 'h' });
  });

  it('parses face ranks and ten', () => {
    expect(parseCard('Td')).toEqual({ rank: 10, suit: 'd' });
    expect(parseCard('Js')).toEqual({ rank: 11, suit: 's' });
    expect(parseCard('Qh')).toEqual({ rank: 12, suit: 'h' });
    expect(parseCard('Kd')).toEqual({ rank: 13, suit: 'd' });
    expect(parseCard('Ah')).toEqual({ rank: 14, suit: 'h' });
  });

  it('is case-insensitive on rank and suit', () => {
    expect(parseCard('ah')).toEqual({ rank: 14, suit: 'h' });
    expect(parseCard('AH')).toEqual({ rank: 14, suit: 'h' });
  });

  it('rejects an invalid rank', () => {
    expect(() => parseCard('Xh')).toThrow();
  });

  it('rejects an invalid suit', () => {
    expect(() => parseCard('Ax')).toThrow();
  });

  it('rejects malformed strings', () => {
    expect(() => parseCard('A')).toThrow();
    expect(() => parseCard('Ahh')).toThrow();
    expect(() => parseCard('')).toThrow();
  });
});

describe('parseBoard', () => {
  it('parses a flop', () => {
    expect(parseBoard(['Ah', 'Kd', '2c'])).toEqual([
      { rank: 14, suit: 'h' },
      { rank: 13, suit: 'd' },
      { rank: 2, suit: 'c' }
    ]);
  });

  it('returns an empty array for no cards', () => {
    expect(parseBoard([])).toEqual([]);
    expect(parseBoard(undefined)).toEqual([]);
  });
});
