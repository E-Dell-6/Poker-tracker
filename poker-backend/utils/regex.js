// Escapes regex metacharacters in user-typed search text before it reaches
// $regex - otherwise a search string containing e.g. `(a+)+$` is passed
// straight through as a live regex, a ReDoS vector on the user's own query.
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
