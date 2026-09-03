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
  profitLoss: { type: Number },
  // min(this player's stack, largest active opponent's stack) / bb-size,
  // at hand start. Computed by effectiveStackCalculator.js at parse time.
  // `null` (not 0) when it can't be derived - stack missing, no bb-size
  // (stakes unset, e.g. PokerNow imports), or no other active player.
  effectiveStackBB: { type: Number, default: null }
});

export const HandSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  handIndex: { type: Number, required: true },

  // The poker site's own hand id (GGPoker's "HD123...", ACR's numeric
  // id). Both parsers already matched this in their header regex and
  // threw it away; it's kept now so overlapping exports of the same
  // session can be deduplicated per-hand instead of only per-file.
  // Null for PokerNow, which has no equivalent - those imports fall
  // back to the file-hash check alone. Not indexed here: hands are
  // embedded subdocuments, so lookups go through the flat HandLedger
  // collection instead (see model/HandLedger.js).
  handId: { type: String, default: null },

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
  // Second runout for a run-it-twice/three-times hand (GGPoker's parser is
  // the first to populate this). Same cumulative-per-street shape as
  // `board`. Left unset for ACR/PokerNow hands and for single-run GGPoker
  // hands - the frontend (HandReplayer.jsx/PokerTable.jsx) already guards
  // its second-board display behind `isRunTwice && secondBoard`.
  secondBoard: {
    flop: [{ type: String }],
    turn: [{ type: String }],
    river: [{ type: String }]
  },

  winners: { type: [String], default: [], required: true},
  finalPotSize: { type: Number },
  isStarred: { type: Boolean, default: false },
  // Whether any player committed their full remaining stack this hand
  // (action still possibly pending elsewhere), computed by
  // allInDetector.js at parse time. `null` (not `false`) when it can't be
  // determined - e.g. a player's starting stack wasn't recorded - so a
  // real all-in never silently reads as "no all-in happened".
  isAllIn: { type: Boolean, default: null },
  // Hero's equity-weighted expected profit at the moment of the all-in,
  // computed by evCalculator.js at parse time. Only ever set when isAllIn
  // is true, hero was a participant, and every other still-live
  // participant's hole cards were revealed - null otherwise (nullable by
  // design: only all-in hands have a value, everything else - including
  // all-in hands where the computation isn't possible from known cards -
  // stays null rather than a fabricated number). Same raw unit as
  // profitLoss for this hand (see evCalculator.js).
  allInEV: { type: Number, default: null },
}, { _id: true });

function cardLimit(val) {
  return val.length === 0 || val.length === 2 || val.length === 4;
}

const Hand = mongoose.models.hand || mongoose.model('Hand', HandSchema);
export default Hand;