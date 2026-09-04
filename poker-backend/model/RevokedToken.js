import mongoose from "mongoose";

// Server-side session invalidation for a stateless JWT.
//
// The token carries its own expiry and is verified with nothing but the
// signing secret, so until now "log out" meant only "stop sending the
// cookie". Anyone who had already copied the token - off a shared machine,
// out of a proxy log, from a stolen backup - kept a working credential for
// the rest of its 7 days, and the real user had no way to kill it.
//
// This is the denylist that makes logout mean something. It stays small by
// construction: only tokens explicitly revoked land here, and each row
// deletes itself the moment the token would have expired anyway, because
// past that point the signature check rejects it for free.
const revokedTokenSchema = new mongoose.Schema({
    // The token's `jti` claim. Unique, so a double-logout is a no-op
    // rather than a duplicate row.
    jti: { type: String, required: true, unique: true, index: true },

    // Set to the token's own `exp`. `expires: 0` makes Mongo's TTL monitor
    // drop the row at exactly this time, so the collection self-cleans and
    // never needs a sweep of its own.
    expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });

const RevokedToken = mongoose.models.revokedToken || mongoose.model('revokedToken', revokedTokenSchema);
export default RevokedToken;
