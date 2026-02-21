import mongoose from 'mongoose';

// 1. ACTION SCHEMA (Must be defined first)
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

// 2. PLAYER SETUP SCHEMA (Must be defined before HandSchema)
const PlayerSetupSchema = new mongoose.Schema({
  seat: { 
    type: Number, 
    required: true 
  },  
  name: { 
    type: String, 
    required: true 
  },  
  stack: { type: Number, required: true },
  isDealer: { type: Boolean, default: false },
  isHero: { type: Boolean, default: false},
  
  holeCards: {
    type: [String], 
    default: [],
    validate: [cardLimit, '{PATH} must be 0 (hidden), 2 (NLH), or 4 (PLO) cards']
  },
  showedHand: { 
    type: [String], 
    default: []
  },
  winnings: { type: Number, default: 0 }
});

// 3. HAND SCHEMA - MUST BE EXPORTED
export const HandSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  handIndex: { type: Number, required: true },

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