// Shared request-shape guards. These are security-relevant, not cosmetic:
// isNonEmptyString is what keeps a NoSQL injection payload like
// { "email": { "$ne": null } } from reaching a Mongoose query, since only
// real strings get past it. It lived privately in authController.js while
// userController.js hand-rolled the same check inline twice - three copies
// of a guard like this is how one of them quietly drifts.

export const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export const normalizeEmail = (email) => email.trim().toLowerCase();
