import mongoose from 'mongoose';

// Shared shape for any "made X out of Y opportunities" stat.
const RateStatSchema = new mongoose.Schema({
  pct: { type: Number, default: 0 },
  made: { type: Number, default: 0 },
  opportunities: { type: Number, default: 0 }
}, { _id: false });

const PlayerStatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true, index: true },

  // Opponent stats are keyed by personId. Hero's own stats reuse this same
  // collection/engine but are keyed by isHero instead, since hero is
  // identified via PlayerSetupSchema.isHero rather than a linked Person.
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', default: null, index: true },
  isHero: { type: Boolean, default: false },

  totalHands: { type: Number, default: 0 },

  vpip: RateStatSchema,
  pfr: RateStatSchema,
  open: RateStatSchema,
  threeBet: RateStatSchema,
  foldTo3Bet: RateStatSchema,
  fourBet: RateStatSchema,
  foldTo4Bet: RateStatSchema,
  steal: RateStatSchema,
  foldToSteal: RateStatSchema,
  limp: RateStatSchema,
  coldCall: RateStatSchema,

  cbFlop: RateStatSchema,
  foldToCbFlop: RateStatSchema,
  checkRaise: RateStatSchema,

  wtsd: RateStatSchema,
  wsd: RateStatSchema,
  wwsf: RateStatSchema,

  aggPct: { type: Number, default: 0 },
  aggFactor: { type: Number, default: 0 },

  totalProfitLoss: { type: Number, default: 0 },
  handsWithProfitData: { type: Number, default: 0 },
  bb100: { type: Number, default: null },
  // Null when this player's tracked hands span more than one currency
  // (mixing units would make totalProfitLoss/bb100 meaningless) - see
  // statsEngine.js's `finalize()` for how this is derived.
  currency: { type: String, enum: ['USD', 'CAD', 'CHIPS', null], default: null },

  lastComputedAt: { type: Date, default: Date.now }
});

// One doc per opponent per user...
PlayerStatsSchema.index(
  { userId: 1, personId: 1 },
  { unique: true, partialFilterExpression: { personId: { $type: 'objectId' } } }
);
// ...and at most one hero doc per user.
PlayerStatsSchema.index(
  { userId: 1, isHero: 1 },
  { unique: true, partialFilterExpression: { isHero: true } }
);

const PlayerStats = mongoose.models.PlayerStats || mongoose.model('PlayerStats', PlayerStatsSchema);
export default PlayerStats;