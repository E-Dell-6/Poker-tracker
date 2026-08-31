export const STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

export const SELECTABLE_ACTION_TYPES = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'];

export const AMOUNT_ACTIONS = new Set(['POST_SB', 'POST_BB', 'BET', 'RAISE', 'CALL']);

export const FOLD_ACTIONS = new Set(['FOLD', 'MUCK']);

export const POSITIONS_BY_COUNT = {
  2: ['BTN/SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
};

export const ACTION_LABELS = {
  POST_SB: 'post sb',
  POST_BB: 'post bb',
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
  SHOW_HAND: 'show hand',
  MUCK: 'muck',
};

export const STREET_LABELS = { PREFLOP: 'Pre-Flop', FLOP: 'Flop', TURN: 'Turn', RIVER: 'River' };

export const STREET_INDEX = { PREFLOP: 0, FLOP: 1, TURN: 2, RIVER: 3 };

export const BOARD_KEY_BY_STREET = { FLOP: 'flop', TURN: 'turn', RIVER: 'river' };
export const BOARD_SLOT_COUNTS = { FLOP: 3, TURN: 1, RIVER: 1 };

export const HOLE_CARD_COUNTS = { NLH: 2, PLO: 4 };
