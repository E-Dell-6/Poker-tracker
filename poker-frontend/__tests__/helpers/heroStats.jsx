import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { STUDY_ROUTES } from '../../src/pages/Stats/studyRoutes.jsx';
import { LiveSessionProvider } from '../../src/context/LiveSessionContext.jsx';

// Not a *.test.jsx file - outside vitest.config.js's `include` glob, so
// this is a plain helper module, not a collected test file.

export function rate(made, opportunities, confidence = 'high') {
  return { pct: opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0, made, opportunities, confidence };
}

// Matches statsEngine.js's finalizePositionStats() shape closely enough for
// PreflopPositionMatrix/PostflopPositionMatrix/PositionalStats to render
// real rows instead of their empty state - RatePct/StatBox-style cells
// tolerate missing rate keys, so this doesn't need to be exhaustive.
export function positionBucket(overrides) {
  return {
    hands: 20, vpip: rate(10, 20), pfr: rate(8, 20), open: rate(6, 20),
    threeBet: rate(2, 8), foldTo3Bet: rate(3, 5), fourBet: rate(1, 2), foldTo4Bet: rate(0, 1),
    steal: rate(4, 6), foldToSteal: rate(1, 3), limp: rate(1, 20), coldCall: rate(2, 20),
    cbFlop: rate(5, 10), foldToCbFlop: rate(2, 6), cbTurn: rate(2, 5), cbRiver: rate(1, 3),
    checkRaise: rate(1, 10), donk: rate(1, 8), probe: rate(1, 4), wwsf: rate(6, 12),
    wtsd: rate(4, 8), wsd: rate(3, 4), aggFactor: 2, bb100: 12.5, totalProfitLoss: 25,
    handsWithProfitData: 20, currency: 'USD',
    ...overrides
  };
}

export function groupBucket(overrides) {
  return {
    hands: 50,
    vpip: rate(25, 50), pfr: rate(20, 50), threeBet: rate(5, 20),
    foldTo3Bet: rate(3, 8), cbFlop: rate(15, 20), foldToCbFlop: rate(2, 10),
    checkRaise: rate(1, 15), wtsd: rate(10, 20), wwsf: rate(12, 20),
    totalProfitLoss: 42.5, handsWithProfitData: 50, bb100: 8.5, currency: 'USD',
    ...overrides
  };
}

export function profitBucket(overrides) {
  return { hands: 10, totalProfitLoss: 50, handsWithProfitData: 10, bb100: 12.5, currency: 'USD', ...overrides };
}

// Matches statsEngine.js's finalizeBoardTextureMap() shape - enough for
// BoardTexture.jsx to render one real tag row instead of its empty state.
function actionMixFixture(overrides) {
  return {
    total: 10,
    bet: { count: 6, pct: 60 }, check: { count: 4, pct: 40 },
    raise: { count: 0, pct: 0 }, call: { count: 0, pct: 0 }, fold: { count: 0, pct: 0 },
    ...overrides
  };
}

export function boardTextureFixture() {
  return {
    monotone: {
      ...profitBucket(),
      actionMix: actionMixFixture(),
      sizing: { avgPotPct: 65, sampleSize: 6 },
      contexts: {
        open: {
          ...profitBucket({ hands: 8 }),
          actionMix: actionMixFixture({ total: 8 }),
          sizing: { avgPotPct: 65, sampleSize: 5 },
          handClasses: { AKs: profitBucket({ hands: 5 }) }
        }
      }
    }
  };
}

export function statsFixture() {
  return {
    totalHands: 100,
    lastComputedAt: '2026-01-01T00:00:00.000Z',
    bb100: 5, vpip: rate(40, 100), pfr: rate(30, 100), threeBet: rate(10, 40),
    cbFlop: rate(20, 40), wtsd: rate(15, 30), wsd: rate(10, 15),
    totalProfitLoss: 120, handsWithProfitData: 100, currency: 'USD',
    positional: { 6: { positions: { BTN: positionBucket() }, vsOpen: {}, vs3Bet: {} } },
    positionCoverage: { hands: 100, totalHands: 100 },
    showdownBreakdown: { wonNoShowdown: 20, wonAtShowdown: 10, lostNoShowdown: 15, lostAtShowdown: 5 },
    byHandClassCategory: { axSuited: profitBucket() },
    byHandClass: {
      AKs: {
        ...profitBucket(),
        category: 'axSuited',
        contexts: { open: { ...profitBucket({ hands: 8 }), byPosition: { BTN: profitBucket({ hands: 8 }) } } }
      }
    },
    byStakes: { '$1/$2': groupBucket() },
    byBoardTexture: boardTextureFixture(),
    preflopMatrix: {}
  };
}

export function mockFetch(statsPayload, filteredPayload = null) {
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/api/user/data')) {
      // StudyLayout gates its real data fetch on being signed in - without
      // this, useIsLoggedIn() reads the generic []-fallback below as
      // "not logged in" and every test would hit the signed-out preview.
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, userData: { name: 'Test User' } }) });
    }
    if (u.includes('/api/stats/me/filtered')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(filteredPayload ?? statsPayload) });
    }
    if (u.endsWith('/api/stats/me')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(statsPayload) });
    }
    // EVGraph's own fetch, Sidebar's live-session polling, etc. - a generic
    // empty result is a safe default none of them error out on.
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
  });
}

// Renders the REAL STUDY_ROUTES tree (not a hand-rolled copy of it) so that
// navigating between subpages in a test exercises the actual shared
// StudyLayout instance - the whole point of the layout route is that it
// survives subpage navigation (one useHeroStats() fetch, filter state kept),
// which only a real nested route tree can prove.
export function renderStudy(initialPath = '/study') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LiveSessionProvider>
        <Routes>{STUDY_ROUTES}</Routes>
      </LiveSessionProvider>
    </MemoryRouter>
  );
}
