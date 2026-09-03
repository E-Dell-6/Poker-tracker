import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderStudy, mockFetch, statsFixture } from './helpers/heroStats.jsx';

describe('Study: shared layout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Recompute CTA and the footer note on every subpage', async () => {
    mockFetch(statsFixture());
    renderStudy('/study/flop');
    await screen.findByText('Board Texture');

    expect(screen.getByRole('button', { name: 'Recompute Stats' })).toBeInTheDocument();
    expect(screen.getByText(/Last computed/)).toBeInTheDocument();
  });

  it('fetches stats once and preserves the stakes filter when navigating between subpages', async () => {
    const user = userEvent.setup();
    const filtered = { ...statsFixture(), totalHands: 7 };
    mockFetch(statsFixture(), filtered);
    renderStudy('/study');
    await screen.findByText('Win rate by position');

    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '$1/$2');
    await screen.findByText('7');

    // Navigation happens via the sidebar's real <Link>s (see Sidebar.jsx's
    // Study subItems) - there's no in-page tab strip.
    await user.click(screen.getByRole('link', { name: 'Flop' }));
    await screen.findByText('Board Texture');

    // Only one call to the unfiltered endpoint - a second useHeroStats()
    // instance mounting on navigation (today's bug, pre-refactor) would
    // fire a second one.
    const baseCalls = globalThis.fetch.mock.calls.filter(([url]) => String(url).endsWith('/api/stats/me'));
    expect(baseCalls).toHaveLength(1);
    expect(screen.getByLabelText('Filter by stakes')).toHaveValue('$1/$2');
  });
});

describe('Study: subpage navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the stat tiles and overview charts only on the /study index page', async () => {
    mockFetch(statsFixture());
    renderStudy('/study');

    expect(await screen.findByText('Win rate by position')).toBeInTheDocument();
    expect(screen.getByText('Showdown breakdown')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // Hands tile value
    expect(screen.queryByText('Win rate by hand class')).not.toBeInTheDocument();
  });

  it('the Hands subpage shows only the hand class breakdown - no tiles, no charts', async () => {
    mockFetch(statsFixture());
    renderStudy('/study/hands');

    expect(await screen.findByText('Win rate by hand class')).toBeInTheDocument();
    expect(screen.queryByText('Win rate by position')).not.toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument(); // Hands tile value
    expect(screen.queryByText('Preflop matrix by position')).not.toBeInTheDocument();
    expect(screen.queryByText('Board Texture')).not.toBeInTheDocument();
  });

  it('switches to the Preflop subpage', async () => {
    const user = userEvent.setup();
    mockFetch(statsFixture());
    renderStudy('/study/hands');
    await screen.findByText('Win rate by hand class');

    await user.click(screen.getByRole('link', { name: 'Preflop' }));

    expect(await screen.findByText('Preflop matrix by position')).toBeInTheDocument();
    expect(screen.queryByText('Win rate by hand class')).not.toBeInTheDocument();
  });

  it('switches to the Flop subpage, which has no tiles, no charts, and no EVGraph', async () => {
    const user = userEvent.setup();
    mockFetch(statsFixture());
    renderStudy('/study/hands');
    await screen.findByText('Win rate by hand class');

    await user.click(screen.getByRole('link', { name: 'Flop' }));

    expect(await screen.findByText('Board Texture')).toBeInTheDocument();
    expect(screen.getByText('Postflop matrix by position')).toBeInTheDocument();
    expect(screen.queryByText('Win rate by position')).not.toBeInTheDocument();
    expect(screen.queryByText('Profit vs. Expected Value')).not.toBeInTheDocument();
  });

  it('no longer shows the Positional Breakdown section anywhere in Study', async () => {
    const user = userEvent.setup();
    mockFetch(statsFixture());
    renderStudy('/study/hands');
    await screen.findByText('Win rate by hand class');

    expect(screen.queryByText('Positional Breakdown')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Flop' }));
    await screen.findByText('Board Texture');
    expect(screen.queryByText('Positional Breakdown')).not.toBeInTheDocument();
  });
});

describe('Study: Stakes/Time filter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call the filtered endpoint on initial load (no filter active)', async () => {
    mockFetch(statsFixture());
    renderStudy();
    await screen.findByText('Win rate by position');

    expect(globalThis.fetch.mock.calls.every(([url]) => !String(url).includes('/filtered'))).toBe(true);
  });

  it('lists stakes from the unfiltered byStakes bucket in the select', async () => {
    mockFetch(statsFixture());
    renderStudy();
    await screen.findByText('Win rate by position');

    expect(screen.getByRole('option', { name: '$1/$2' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All stakes' })).toBeInTheDocument();
  });

  it('choosing a stakes value calls the filtered endpoint and swaps in its data', async () => {
    const user = userEvent.setup();
    const filtered = { ...statsFixture(), totalHands: 7 };
    mockFetch(statsFixture(), filtered);
    renderStudy();
    await screen.findByText('Win rate by position');

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
    renderStudy();
    await screen.findByText('Win rate by position');

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
    renderStudy();
    await screen.findByText('Win rate by position');

    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '$1/$2');

    expect(await screen.findByText('No hands match this filter')).toBeInTheDocument();
  });

  it('reverts to the unfiltered view with no extra request when the filter is cleared', async () => {
    const user = userEvent.setup();
    const filtered = { ...statsFixture(), totalHands: 7 };
    mockFetch(statsFixture(), filtered);
    renderStudy();
    await screen.findByText('Win rate by position');

    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '$1/$2');
    await screen.findByText('7');

    const callsBeforeClear = globalThis.fetch.mock.calls.length;
    await user.selectOptions(screen.getByLabelText('Filter by stakes'), '');

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.length).toBe(callsBeforeClear);
  });
});
