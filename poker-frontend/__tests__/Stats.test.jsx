import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Stats } from '../src/pages/Stats/Stats.jsx';
import { LiveSessionProvider } from '../src/context/LiveSessionContext.jsx';

// Stats.jsx renders inside Layout, which renders Sidebar (uses react-router's
// Link/useLocation, and useLiveSession() - needs LiveSessionProvider as an
// ancestor, same as the real app's App.jsx) - both are required for this to
// render at all in a test.
function renderStats() {
  return render(
    <MemoryRouter>
      <LiveSessionProvider>
        <Stats />
      </LiveSessionProvider>
    </MemoryRouter>
  );
}

function rate(made, opportunities, confidence = 'high') {
  return { pct: opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0, made, opportunities, confidence };
}

// Matches statsEngine.js's finalizePositionStats() shape closely enough for
// PositionMatrixTables/PositionalStats to render real rows instead of their
// empty state - RatePct/StatBox-style cells tolerate missing rate keys, so
// this doesn't need to be exhaustive.
function positionBucket(overrides) {
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

function groupBucket(overrides) {
  return {
    hands: 50,
    vpip: rate(25, 50), pfr: rate(20, 50), threeBet: rate(5, 20),
    foldTo3Bet: rate(3, 8), cbFlop: rate(15, 20), foldToCbFlop: rate(2, 10),
    checkRaise: rate(1, 15), wtsd: rate(10, 20), wwsf: rate(12, 20),
    totalProfitLoss: 42.5, handsWithProfitData: 50, bb100: 8.5, currency: 'USD',
    ...overrides
  };
}

function profitBucket(overrides) {
  return { hands: 10, totalProfitLoss: 50, handsWithProfitData: 10, bb100: 12.5, currency: 'USD', ...overrides };
}

function statsFixture() {
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
    byStackDepth: {},
    byFlopTexture: {},
    byBoardTexture: {}
  };
}

function mockFetch(statsPayload, filteredPayload = null) {
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/api/user/data')) {
      // Stats.jsx gates its real data fetch on being signed in - without
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

describe('Stats page: section tabs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to the Hands tab', async () => {
    mockFetch(statsFixture());
    renderStats();

    expect(await screen.findByText('Win rate by hand class')).toBeInTheDocument();
    expect(screen.queryByText('Preflop matrix by position')).not.toBeInTheDocument();
    expect(screen.queryByText('By Stakes / Stack Depth / Texture')).not.toBeInTheDocument();
  });

  it('switches to the Position tab and hides the Hands content', async () => {
    const user = userEvent.setup();
    mockFetch(statsFixture());
    renderStats();
    await screen.findByText('Win rate by hand class');

    await user.click(screen.getByRole('button', { name: 'Position' }));

    expect(screen.getByText('Preflop matrix by position')).toBeInTheDocument();
    expect(screen.getByText('Positional Breakdown')).toBeInTheDocument();
    expect(screen.queryByText('Win rate by hand class')).not.toBeInTheDocument();
  });

  it('switches to the Board tab and hides the Position content', async () => {
    const user = userEvent.setup();
    mockFetch(statsFixture());
    renderStats();
    await screen.findByText('Win rate by hand class');

    await user.click(screen.getByRole('button', { name: 'Board' }));

    expect(screen.getByText('By Stakes / Stack Depth')).toBeInTheDocument();
    expect(screen.queryByText('Preflop matrix by position')).not.toBeInTheDocument();
  });

  it('keeps the overview charts visible regardless of the active tab', async () => {
    const user = userEvent.setup();
    mockFetch(statsFixture());
    renderStats();
    await screen.findByText('Win rate by hand class');

    // StudyCharts' card headers render outside the chart's own SVG (which
    // recharts doesn't draw in jsdom without real layout - see
    // EVGraph.test.jsx), so this text is a reliable presence check. It's
    // gated on StudyCharts' own activeSize state, which starts null and is
    // set via a useEffect (defaults to the most-played table size - see
    // StudyCharts.jsx) - an extra render pass after mount, independent of
    // Stats.jsx's own fetch - so this needs findByText (async), not
    // getByText, or it races that effect.
    expect(await screen.findByText('Win rate by position')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Board' }));
    expect(screen.getByText('Win rate by position')).toBeInTheDocument();
  });
});

describe('Stats page: Stakes/Time filter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call the filtered endpoint on initial load (no filter active)', async () => {
    mockFetch(statsFixture());
    renderStats();
    await screen.findByText('Win rate by hand class');

    expect(globalThis.fetch.mock.calls.every(([url]) => !String(url).includes('/filtered'))).toBe(true);
  });

  it('lists stakes from the unfiltered byStakes bucket in the select', async () => {
    mockFetch(statsFixture());
    renderStats();
    await screen.findByText('Win rate by hand class');

    expect(screen.getByRole('option', { name: '$1/$2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All stakes' })).toBeInTheDocument();
  });

  it('choosing a stakes value calls the filtered endpoint and swaps in its data', async () => {
    const user = userEvent.setup();
    const filtered = { ...statsFixture(), totalHands: 7 };
    mockFetch(statsFixture(), filtered);
    renderStats();
    await screen.findByText('Win rate by hand class');

    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '$1/$2');

    await screen.findByText('7');
    const filteredCall = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('/filtered'));
    expect(filteredCall).toBeTruthy();
    expect(filteredCall[0]).toContain('stakes=%241%2F%242');
  });

  it('clicking a time preset calls the filtered endpoint with a from= param', async () => {
    const user = userEvent.setup();
    const filtered = { ...statsFixture(), totalHands: 3 };
    mockFetch(statsFixture(), filtered);
    renderStats();
    await screen.findByText('Win rate by hand class');

    await user.click(screen.getByRole('button', { name: '30D' }));

    await screen.findByText('3');
    const filteredCall = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('/filtered'));
    expect(filteredCall).toBeTruthy();
    expect(filteredCall[0]).toContain('from=');
  });

  it('shows a "no hands match" message when the filtered result has zero hands', async () => {
    const user = userEvent.setup();
    const filtered = { ...statsFixture(), totalHands: 0 };
    mockFetch(statsFixture(), filtered);
    renderStats();
    await screen.findByText('Win rate by hand class');

    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '$1/$2');

    expect(await screen.findByText('No hands match this filter')).toBeInTheDocument();
  });

  it('reverts to the unfiltered view with no extra request when the filter is cleared', async () => {
    const user = userEvent.setup();
    const filtered = { ...statsFixture(), totalHands: 7 };
    mockFetch(statsFixture(), filtered);
    renderStats();
    await screen.findByText('Win rate by hand class');

    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '$1/$2');
    await screen.findByText('7');

    const callsBeforeClear = globalThis.fetch.mock.calls.length;
    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '');

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.length).toBe(callsBeforeClear);
  });
});
