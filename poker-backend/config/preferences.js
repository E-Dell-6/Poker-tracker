// User-facing presentation settings. Both fields are enums on purpose: the
// accent key is interpolated into a data-attribute that CSS selects on, so
// accepting an arbitrary string here would be a styling-injection vector.
// Storing a KEY rather than a color means the set of reachable values is
// fixed at the schema, not at whichever caller happens to remember to
// validate - and the hex values stay in theme.css, authored by us.

export const ACCENT_KEYS = ['orange', 'teal', 'violet', 'blue', 'rose', 'lime'];

// 'light' and 'system' are accepted from the start even though the UI ships
// dark-only - the light token block is a follow-up (it needs a sweep of the
// ~190 hardcoded colors still left in component CSS). Having the values in
// the enum now means that follow-up is purely additive, with no migration.
export const THEME_KEYS = ['dark', 'light', 'system'];

export const DEFAULT_PREFERENCES = { theme: 'dark', accent: 'orange' };

// Whitelist by construction: builds the patch from known keys instead of
// filtering a caller-supplied object, so an unexpected key cannot survive by
// being spelled in a way a denylist missed. It also drops, with no special
// case, the `userId` that userAuth injects into req.body.
//
// Returns dotted $set paths so a PATCH of { accent } alone cannot clobber
// theme, and null on any bad value so the caller answers with a message
// rather than storing junk.
export function sanitizePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const patch = {};
  if ('theme' in input) {
    if (!THEME_KEYS.includes(input.theme)) return null;
    patch['preferences.theme'] = input.theme;
  }
  if ('accent' in input) {
    if (!ACCENT_KEYS.includes(input.accent)) return null;
    patch['preferences.accent'] = input.accent;
  }
  return Object.keys(patch).length ? patch : null;
}
