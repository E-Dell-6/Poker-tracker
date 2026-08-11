import mongoose from 'mongoose';

const ActionSchema = new mongoose.Schema({
  street: { 
    type: String, 
    enum: ['PREFLOP', 'FLOP', 'TURN', 'RIVER'], 
  },
  actionType: { 
    type: String, 
    enum: ['POST_SB', 'POST_BB', 'FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'SHOW_HAND', 'MUCK'], 
  },
  player: {
    type: String
  },
  amount: { type: Number, default: 0 }, 
  potSizeAfter: { type: Number } 
});

const PlayerSetupSchema = new mongoose.Schema({
  seat: { 
    type: Number
  },  
  name: { 
    type: String, 
    required: true 
  },  
  // Optional link back to a saved Person. `name` stays a plain string
  // snapshot so past hands don't change if the Person is renamed later;
  // personId is only set when the user explicitly links a seat.
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    default: null
  },
  // Not required: a player who sat out this hand has no stack figure to
  // record (both parsers store `null` for them), so this must be able to
  // stay empty rather than fail validation.
  stack: { type: Number, default: null },
  isDealer: { type: Boolean, default: false },
  isHero: { type: Boolean, default: false},
  // True when this player was seated at the table but not dealt into this
  // particular hand. Distinguishes "sitting out this hand" from "not part
  // of the session at all" — previously both cases just meant the player
  // was absent from `players`, with no way to tell them apart.
  isSittingOut: { type: Boolean, default: false },
  
  holeCards: {
    type: [String], 
    default: [],
    validate: [cardLimit, '{PATH} must be 0 (hidden), 2 (NLH), or 4 (PLO) cards']
  },
  showedHand: { 
    type: [String], 
    default: []
  },
  winnings: { type: Number, default: 0 },
  // Actual net result for this player for this hand: winnings minus
  // chips they put into the pot (not just pot-size-if-won). Computed by
  // handProfitCalculator.js at parse time. Deliberately has NO default —
  // hands parsed before this field existed should stay `undefined` here,
  // so SessionLog.jsx's `typeof hero.profitLoss === "number"` check falls
  // through to its old estimate instead of every historical hand reading
  // as a false $0.00 break-even.
  profitLoss: { type: Number }
});

export const HandSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  handIndex: { type: Number, required: true },

  notes: { type: String, default: '' },

  gameType: { type: String, enum: ['NLH', 'PLO']},
  stakes: { type: String },
  datePlayed: { type: Date, default: Date.now },

  players: [PlayerSetupSchema], 
  
  actions: [ActionSchema],
  isRunTwice: { type: Boolean, default: false },
  board: {
    flop: [{ type: String }],
    turn: [{ type: String }],
    river: [{ type: String }]
  },

  winners: { type: [String], default: [], required: true}, 
  finalPotSize: { type: Number },
  isStarred: { type: Boolean, default: false },
}, { _id: true });

function cardLimit(val) {
  return val.length === 0 || val.length === 2 || val.length === 4;
}

const Hand = mongoose.models.hand || mongoose.model('Hand', HandSchema);
export default Hand;