import mongoose from 'mongoose';

// Per-hand dedup index, kept as its own collection rather than a query
// over Session.hands.
//
// Why a separate collection: hands are embedded subdocuments
// (Session.hands), so asking "have I already imported hand HD12345?"
// against them means scanning every session's whole hand array - and
// there's no way to index an embedded field for the 20k-at-a-time lookups
// a folder import needs. A flat {userId, handId} collection with a unique
// compound index turns the whole question into one insertMany per file:
// insert with ordered:false, and every E11000 that comes back names a hand
// this user already has.
//
// This is what stops a re-exported session from silently double-counting.
// The existing file-level SHA-256 check only catches byte-identical
// re-uploads, which a fresh export from the site never is.
//
// NOTE: PokerNow exports carry no site hand ID (their CSV has no such
// column), so PokerNow hands are never written here and keep file-hash
// dedup only. Callers must skip null handIds rather than storing them -
// a unique index would otherwise collapse every PokerNow hand into one.
const HandLedgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  // The site's own hand id (GGPoker "HD123...", ACR's numeric id), as a
  // string - these are opaque identifiers, not numbers to compare.
  handId: { type: String, required: true },
  // Which session it landed in, so a deleted session can clean up its
  // ledger rows and allow a legitimate re-import.
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'session', required: true },
  importedAt: { type: Date, default: Date.now },
});

// The dedup primitive. Unique so insertMany({ordered:false}) reports
// collisions as E11000 rather than silently inserting duplicates.
HandLedgerSchema.index({ userId: 1, handId: 1 }, { unique: true });
// Cleanup path when a session is deleted.
HandLedgerSchema.index({ sessionId: 1 });

const HandLedger = mongoose.models.HandLedger || mongoose.model('HandLedger', HandLedgerSchema);
export default HandLedger;
