import mongoose from 'mongoose';

// 1. ACTION SCHEMA (Must be defined first)
const ActionSchema = new mongoose.Schema({
  street: { 
    type: String, 
    enum: ['PREFLOP', 'FLOP', 'TURN', 'RIVER',], 
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
    type: Boolean, 
    default: false 
  }
});

const HandSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  handIndex: { type: Number, required: true },

  gameType: { type: String, enum: ['NLH', 'PLO']},
  stakes: { type: String },
  datePlayed: { type: Date, default: Date.now },
  
  // Reference the Schema variable defined above
  players: [PlayerSetupSchema], 
  
  buttonSeat: { type: Number, required: true },
  heroSeat: { type: Number, required: true},

  actions: [ActionSchema],

  board: {
    flop: [{ type: String }],
    turn: [{ type: String }],
    river: [{ type: String }]
  },

  winners: [{ name: String, amount: Number }], 
  finalPotSize: { type: Number }
});

function cardLimit(val) {
  return val.length === 0 || val.length === 2 || val.length === 4;
}

export default mongoose.model('Hand', HandSchema);