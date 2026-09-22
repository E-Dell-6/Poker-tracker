import { describe, it, expect } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Settings.test.jsx asserts that picking a swatch sets data-accent on <html>.
// That is necessary but not sufficient, and on its own it missed a real bug:
// the attribute was set correctly while the CSS never acted on it, so the app
// stayed orange no matter what you clicked.
//
// [data-accent="teal"] and :root both score (0,1,0), so the cascade fell
// through to source order - and the :root fallback, declared last, won every
// time. These tests resolve --color-accent through an actual cascade instead
// of trusting the attribute, which is the only way to catch that class of
// mistake.

const THEME_CSS = path.resolve(__dirname, '../src/styles/theme.css');

// The @import must be stripped whole-line: the Google Fonts URL contains ';'
// characters (wght@400;500;600...), so a /@import[^;]+;/ regex leaves a
// fragment that breaks the parser - and a stylesheet that fails to parse
// makes every assertion below trivially "pass" against empty strings.
function loadCss() {
  return fs.readFileSync(THEME_CSS, 'utf8').replace(/^\s*@import\b.*$/gm, '');
}

function accentFor(attr) {
  const css = loadCss();
  const html = attr
    ? `<!doctype html><html data-accent="${attr}"><head><style>${css}</style></head></html>`
    : `<!doctype html><html><head><style>${css}</style></head></html>`;
  const dom = new JSDOM(html);
  return dom.window
    .getComputedStyle(dom.window.document.documentElement)
    .getPropertyValue('--color-accent')
    .trim();
}

const PRESETS = {
  orange: '#f97316',
  teal: '#14b8a6',
  violet: '#8b5cf6',
  blue: '#3b82f6',
  rose: '#f43f5e',
  lime: '#84cc16',
};

describe('theme.css accent presets', () => {
  it('parses as valid CSS', () => {
    // Guards every other test here: a sheet that fails to parse yields empty
    // strings, which would quietly turn real failures into passes.
    let ok = true;
    const vc = new VirtualConsole();
    vc.on('jsdomError', () => { ok = false; });
    new JSDOM(`<!doctype html><html><head><style>${loadCss()}</style></head></html>`, { virtualConsole: vc });
    expect(ok).toBe(true);
  });

  it.each(Object.entries(PRESETS))('resolves --color-accent for %s', (key, hex) => {
    expect(accentFor(key)).toBe(hex);
  });

  it('gives every preset a distinct color', () => {
    // Otherwise a preset silently falling back to orange still "passes" the
    // per-key checks above if its own hex were ever mistyped to match.
    const resolved = Object.keys(PRESETS).map(accentFor);
    expect(new Set(resolved).size).toBe(Object.keys(PRESETS).length);
  });

  it('falls back to orange when no accent is set', () => {
    // The pre-JS first paint, and any viewer whose preference never loaded.
    expect(accentFor(null)).toBe('#f97316');
  });

  it('gives every preset both a :root form and a bare form', () => {
    // The structural invariant behind all of the above, and both halves are
    // load-bearing:
    //   :root[data-accent] - (0,2,0), so it beats the :root fallback that
    //     ties with a bare attribute selector and wins on source order.
    //   [data-accent]      - matches a non-root element, so a swatch can
    //     paint itself in a preset that isn't the active one.
    // Dropping either one broke the feature in a different way.
    const css = fs.readFileSync(THEME_CSS, 'utf8');
    const selectors = css
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('[data-accent=') || line.startsWith(':root[data-accent='))
      .map((line) => line.replace(/\s*[{,].*$/, ''));

    for (const key of Object.keys(PRESETS)) {
      expect(selectors).toContain(`:root[data-accent="${key}"]`);
      expect(selectors).toContain(`[data-accent="${key}"]`);
    }
  });
});

// The swatches in Settings carry data-accent themselves so each renders in
// its own preset rather than the active one - that keeps the hex values in
// theme.css with no second copy in JS. Scoping the presets to :root alone
// silently made all six render identically, in whatever accent was active.
describe('theme.css accents on a non-root element', () => {
  function swatchColors(pageAccent) {
    const css = loadCss();
    const buttons = Object.keys(PRESETS)
      .map((k) => `<button id="sw-${k}" data-accent="${k}"></button>`)
      .join('');
    const dom = new JSDOM(
      `<!doctype html><html data-accent="${pageAccent}"><head><style>${css}</style></head>` +
      `<body>${buttons}</body></html>`
    );
    const { window: w } = dom;
    return Object.fromEntries(
      Object.keys(PRESETS).map((k) => [
        k,
        w.getComputedStyle(w.document.getElementById(`sw-${k}`))
          .getPropertyValue('--color-accent').trim(),
      ])
    );
  }

  it('paints each swatch in its own preset, not the active accent', () => {
    expect(swatchColors('violet')).toEqual(PRESETS);
  });

  it('keeps the swatches distinct whichever accent is active', () => {
    // The visible symptom was six identical circles, which an equality check
    // on a single arrangement could still miss if the presets were aliased.
    for (const active of Object.keys(PRESETS)) {
      const colors = Object.values(swatchColors(active));
      expect(new Set(colors).size).toBe(Object.keys(PRESETS).length);
    }
  });

  it('still themes the page itself from the root attribute', () => {
    // The bare selector must not cost the root rule its win.
    const css = loadCss();
    const dom = new JSDOM(
      `<!doctype html><html data-accent="teal"><head><style>${css}</style></head>` +
      `<body><button data-accent="rose"></button></body></html>`
    );
    const { window: w } = dom;
    expect(
      w.getComputedStyle(w.document.documentElement)
        .getPropertyValue('--color-accent').trim()
    ).toBe(PRESETS.teal);
  });
});
