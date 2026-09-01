import mongoose from 'mongoose';

// Shared shape for any "made X out of Y opportunities" stat. `confidence`
// is computed once in statsEngine.js's finalizeRate() (see confidence.js)
// and stored alongside the counters it was derived from, so it can't drift
// out of sync with them - never recomputed ad hoc by a consumer.
const RateStatSchema = new mongoose.Schema({
  pct: { type: Number, default: 0 },
  made: { type: Number, default: 0 },
  opportunities: { type: Number, default: 0 },
  confidence: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
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
  cbTurn: RateStatSchema,
  cbRiver: RateStatSchema,
  donk: RateStatSchema,
  probe: RateStatSchema,
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

  // Position-vs-position breakdown, bucketed by table size (2-9 active
  // players): { "<tableSize>": { positions: { "<pos>": {open, threeBet,
  // foldTo3Bet, ...} }, vsOpen: { "<attackerPos>": { "<responderPos>":
  // {faced, folded, called, raised, foldPct, raisePct, defendPct} } },
  // vs3Bet: { same shape, one level deeper } } }.
  // Mixed because the set of positions/table sizes present varies per
  // player and doesn't map cleanly onto a fixed schema - see
  // statsEngine.js's finalizePositional() for exactly what gets written.
  positional: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Same rate-stat set as the top level, sliced by grouping dimension - see
  // statsEngine.js's newGroupStats()/finalizeGroupMap(). Keys are raw
  // stakes strings, stack-depth buckets ('short'|'mid'|'deep'), or a
  // `${stakes}__${bucket}` combination. Mixed for the same reason as
  // `positional`: the set of keys present varies per player.
  byStakes: { type: mongoose.Schema.Types.Mixed, default: {} },
  byStackDepth: { type: mongoose.Schema.Types.Mixed, default: {} },
  byStakesAndStackDepth: { type: mongoose.Schema.Types.Mixed, default: {} },
  // 'dry'|'semi-wet'|'wet' -> { hands, cbFlop, foldToCbFlop, checkRaise } -
  // see flopTexture.js/statsEngine.js's newTextureStats().
  byFlopTexture: { type: mongoose.Schema.Types.Mixed, default: {} },

  // { wonNoShowdown, wonAtShowdown, lostNoShowdown, lostAtShowdown } - raw
  // hand counts, hand-wide (not per-position) - see
  // statsEngine.js's newShowdownBreakdown().
  showdownBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Win rate by starting hand - see statsEngine.js's handClass-related
  // helpers. byHandClassCategory: broad category ('pocketPairs', 'axSuited',
  // ...) -> {hands, totalProfitLoss, bb100, currency}. byHandClass: specific
  // 169-hand-class token ("AKs") -> the same profit fields plus `category`
  // and a `contexts` breakdown (preflop action type -> profit figure -> a
  // `byPosition` breakdown). Mixed for the same reason as `positional`: the
  // set of hand classes/contexts/positions present varies per player.
  byHandClassCategory: { type: mongoose.Schema.Types.Mixed, default: {} },
  byHandClass: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Range-matrix grid for the Study page's "Range Matrix" subpage - see
  // statsEngine.js's classifyHeroPreflopMatrixDecision/ensurePreflopMatrixCell.
  // { "<tableSize>" (only "6" populated today): { rfi: { "<heroPos>":
  // { "<token>": {fold,call,raise,total,foldPct,callPct,raisePct,confidence} } },
  // vsOpen: { "<heroPos>": { "<facingPos>": { "<token>": {...} } } },
  // vs3Bet: same shape as vsOpen } }. Mixed for the same reason as
  // `positional`/`byHandClass`: the set of hands/positions present varies
  // per player.
  preflopMatrix: { type: mongoose.Schema.Types.Mixed, default: {} },

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