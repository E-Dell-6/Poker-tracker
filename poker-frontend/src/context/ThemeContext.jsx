import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { updatePreferences } from '../api/user';

const ThemeContext = createContext(null);

// Mirrors the key read by the inline script in index.html. That script is
// what makes the first paint correct; this is the only thing that writes it.
const CACHE_KEY = 'pf:prefs';
const DEFAULTS = { theme: 'dark', accent: 'orange' };

// Every localStorage access is wrapped: a private window, cleared site data,
// or a browser set to block storage can make these throw outright, and a
// theme preference is never worth taking the app down for.
function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeCache(prefs) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
  } catch {
    // Non-fatal: the preference still applies for this page view, it just
    // won't survive to beat the next load's first paint.
  }
}

function resolveTheme(theme) {
  if (theme !== 'system') return theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(prefs) {
  const d = document.documentElement;
  d.dataset.accent = prefs.accent;
  d.dataset.theme = resolveTheme(prefs.theme);
}

// Appearance preferences, persisted on the User document so they follow the
// user across devices rather than living only in this browser.
//
// Seeded synchronously from the same cache the inline script read, so the
// provider can never contradict what's already painted. The server is the
// source of truth and reconciles in via syncFromServer() once the app's
// existing getUserData() call lands - there's deliberately no fetch here,
// since that call is already being made on every page.
export function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(readCache);

  useEffect(() => {
    apply(prefs);
    writeCache(prefs);
  }, [prefs]);

  // Only meaningful while following the OS; a fixed choice ignores it.
  useEffect(() => {
    if (prefs.theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply(prefs);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs]);

  // Optimistic: a swatch click has to feel instant, so the DOM updates first
  // and the write happens behind it. A rejected write rolls the UI back to
  // what the server actually holds rather than leaving the two disagreeing.
  const save = useCallback(async (patch) => {
    let previous;
    setPrefs((current) => {
      previous = current;
      return { ...current, ...patch };
    });
    try {
      const data = await updatePreferences(patch);
      if (!data?.success) {
        setPrefs(previous);
        return { success: false, message: data?.message ?? 'Could not save preference' };
      }
      // Trust the server's echo over the optimistic guess.
      if (data.preferences) setPrefs({ ...DEFAULTS, ...data.preferences });
      return { success: true };
    } catch {
      setPrefs(previous);
      return { success: false, message: 'Could not save preference' };
    }
  }, []);

  const setAccent = useCallback((accent) => save({ accent }), [save]);
  const setTheme = useCallback((theme) => save({ theme }), [save]);

  // Called with the `preferences` block from an existing getUserData()
  // response, so the server's values win over a stale local cache without
  // costing an extra round trip.
  const syncFromServer = useCallback((serverPrefs) => {
    if (serverPrefs) setPrefs({ ...DEFAULTS, ...serverPrefs });
  }, []);

  return (
    <ThemeContext.Provider value={{ ...prefs, setAccent, setTheme, syncFromServer }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
