import { describe, it, expect } from 'vitest';
import { parseBoard } from '../cardParser.js';
import { classifyFlopTexture } from '../flopTexture.js';

function texture(cards) {
  return classifyFlopTexture(parseBoard(cards));
}

describe('classifyFlopTexture', () => {
  it('rainbow + disconnected + unpaired -> dry', () => {
    const t = texture(['Ah', '7c', '2d']);
    expect(t.wetness).toBe('dry');
    expect(t.rainbow).toBe(true);
    expect(t.paired).toBe(false);
  });

  it('monotone -> wet, regardless of connectivity', () => {
    const t = texture(['Ah', '7h', '2h']);
    expect(t.wetness).toBe('wet');
    expect(t.monotone).toBe(true);
  });

  it('two-tone + connected -> wet', () => {
    const t = texture(['9h', '8h', '6c']);
    expect(t.wetness).toBe('wet');
    expect(t.twoTone).toBe(true);
    expect(t.connected).toBe(true);
  });

  it('rainbow + connected -> semi-wet', () => {
    const t = texture(['9h', '8c', '6d']);
    expect(t.wetness).toBe('semi-wet');
  });

  it('two-tone + disconnected -> semi-wet', () => {
    const t = texture(['Kh', '7h', '2c']);
    expect(t.wetness).toBe('semi-wet');
  });

  it('paired rainbow disconnected -> semi-wet, not dry', () => {
    const t = texture(['Kh', 'Kc', '2d']);
    expect(t.wetness).toBe('semi-wet');
    expect(t.paired).toBe(true);
  });

  it('reports the flop high card', () => {
    expect(texture(['Kh', '7c', '2d']).highCard).toBe(13);
    expect(texture(['Ah', '7c', '2d']).highCard).toBe(14);
  });

  it('throws for a board that is not exactly 3 cards', () => {
    expect(() => classifyFlopTexture(parseBoard(['Ah', '7c']))).toThrow();
    expect(() => classifyFlopTexture(parseBoard(['Ah', '7c', '2d', '3s']))).toThrow();
  });
});
