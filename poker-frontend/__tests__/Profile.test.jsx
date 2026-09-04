import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from '../src/pages/Profile/Profile.jsx';
import { LiveSessionProvider } from '../src/context/LiveSessionContext.jsx';
import { ImportProvider } from '../src/context/ImportContext.jsx';

// Profile.jsx renders inside Layout, which renders Sidebar (uses react-router's
// Link/useLocation, and useLiveSession()) and reads useImport() for its drop
// zone - all three required for this to render, as they are in App.jsx.
function renderProfile() {
  return render(
    <MemoryRouter>
      <LiveSessionProvider>
        <ImportProvider>
          <Profile />
        </ImportProvider>
      </LiveSessionProvider>
    </MemoryRouter>
  );
}

function evRow(handIndex, actualResult, cumulativeActual, evResult, cumulativeEV) {
  return { handIndex, actualResult, cumulativeActual, evResult, cumulativeEV };
}

function mockFetch({ evRows = [] } = {}) {
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/api/user/data')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, userData: { name: 'Test User' } }) });
    }
    if (u.includes('/api/sessions')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }
    if (u.includes('/api/live-sessions')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }
    if (u.includes('/api/stats/me/ev-graph')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(evRows) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
  });
}

describe('Profile: EV chart card', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders both chart cards with distinct titles, no duplicated heading', async () => {
    mockFetch({ evRows: [evRow(0, 10, 10, 10, 5), evRow(1, -20, -10, 5, 10)] });
    renderProfile();

    expect(await screen.findByText('Cumulative Profit')).toBeInTheDocument();
    expect(await screen.findByText('Profit vs. Expected Value')).toBeInTheDocument();
    // EVGraph's own internal .pos-section-header title is suppressed via
    // heading={false} - only Profile's .chart-title renders it, once.
    expect(screen.getAllByText('Profit vs. Expected Value')).toHaveLength(1);
  });

  it('fetches the EV graph with no query params on initial load (All Time)', async () => {
    mockFetch({ evRows: [] });
    renderProfile();
    await screen.findByText('Profit vs. Expected Value');

    const evCall = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('/ev-graph'));
    expect(evCall).toBeTruthy();
    expect(String(evCall[0]).endsWith('/api/stats/me/ev-graph')).toBe(true);
  });

  it('clicking a time filter issues a new EV graph request with a from= param', async () => {
    const user = userEvent.setup();
    mockFetch({ evRows: [evRow(0, 10, 10, 10, 5), evRow(1, -20, -10, 5, 10)] });
    renderProfile();
    await screen.findByText('Profit vs. Expected Value');

    const callsBefore = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/ev-graph')).length;

    await user.click(screen.getByRole('button', { name: '30D' }));

    await waitFor(() => {
      const evCalls = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/ev-graph'));
      expect(evCalls.length).toBeGreaterThan(callsBefore);
    });
    const latestEvCall = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/ev-graph')).at(-1);
    expect(latestEvCall[0]).toContain('from=');
  });
});
