import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EVGraph } from '../src/components/EVGraph.jsx';

// recharts' ResponsiveContainer needs real layout (getBoundingClientRect)
// to size its children, which jsdom doesn't compute - so these tests
// verify the states/data the component controls directly (loading, error,
// empty, header/legend/total), not the chart's internal SVG output, which
// is recharts' own responsibility, not this component's.

function mockFetchOnce(response, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response)
  });
}

function row(handIndex, actualResult, cumulativeActual, evResult, cumulativeEV) {
  return { handIndex, actualResult, cumulativeActual, evResult, cumulativeEV };
}

describe('EVGraph', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a skeleton while the initial fetch is in flight', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})); // never resolves
    const { container } = render(<EVGraph />);
    expect(container.querySelector('.ui-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Profit vs. Expected Value')).toBeInTheDocument();
  });

  it('omits the header when heading={false}', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})); // never resolves
    render(<EVGraph heading={false} />);
    expect(screen.queryByText('Profit vs. Expected Value')).not.toBeInTheDocument();
  });

  it('fetches from the ev-graph endpoint with credentials included', () => {
    mockFetchOnce([]);
    render(<EVGraph />);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/stats/me/ev-graph'),
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('fetches with no query string when no filter props are given', () => {
    mockFetchOnce([]);
    render(<EVGraph />);
    const url = globalThis.fetch.mock.calls[0][0];
    expect(url.endsWith('/api/stats/me/ev-graph')).toBe(true);
  });

  it('appends stakes/from/to as query params when the Study page filter is active', () => {
    mockFetchOnce([]);
    render(<EVGraph stakes="$1/$2" from="2026-01-01" to="2026-02-01" />);
    const url = globalThis.fetch.mock.calls[0][0];
    expect(url).toContain('stakes=%241%2F%242');
    expect(url).toContain('from=2026-01-01');
    expect(url).toContain('to=2026-02-01');
  });

  it('refetches when the filter props change', () => {
    // mockFetchOnce uses mockResolvedValue (not -Once), so the same mock
    // keeps resolving every call - no need to re-arm it before rerender.
    mockFetchOnce([]);
    const { rerender } = render(<EVGraph stakes="$1/$2" />);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    rerender(<EVGraph stakes="$5/$10" />);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch.mock.calls[1][0]).toContain('stakes=%245%2F%2410');
  });

  it('shows a placeholder when there are fewer than 2 hands of data', async () => {
    mockFetchOnce([row(0, 10, 10, 10, 10)]); // only 1 row
    render(<EVGraph />);
    expect(await screen.findByText(/Not enough hand-by-hand data/i)).toBeInTheDocument();
  });

  it('shows the same placeholder for an empty result', async () => {
    mockFetchOnce([]);
    render(<EVGraph />);
    expect(await screen.findByText(/Not enough hand-by-hand data/i)).toBeInTheDocument();
  });

  it('shows an error message when the response is not ok', async () => {
    mockFetchOnce({}, false);
    render(<EVGraph />);
    expect(await screen.findByText('Failed to load EV graph')).toBeInTheDocument();
  });

  it('shows an error message when fetch itself rejects (network failure)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    render(<EVGraph />);
    expect(await screen.findByText('network down')).toBeInTheDocument();
  });

  it('renders the header, legend, and running total once enough data loads', async () => {
    mockFetchOnce([
      row(0, 10, 10, 10, 5),
      row(1, -20, -10, 5, 10)
    ]);
    render(<EVGraph />);

    expect(await screen.findByText('Profit vs. Expected Value')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
    expect(screen.getByText('All-in EV')).toBeInTheDocument();
    // Total is the LAST row's cumulativeActual (-10), formatted signed.
    expect(screen.getByText('-10.00')).toBeInTheDocument();
  });

  it('gives the running total a negative-styling class when cumulativeActual is below zero', async () => {
    mockFetchOnce([row(0, -5, -5, 0, 0), row(1, -5, -10, 0, 0)]);
    render(<EVGraph />);
    const total = await screen.findByText('-10.00');
    expect(total).toHaveClass('neg');
  });

  it('gives the running total a positive-styling class when cumulativeActual is at or above zero', async () => {
    mockFetchOnce([row(0, 5, 5, 0, 0), row(1, 5, 10, 0, 0)]);
    render(<EVGraph />);
    const total = await screen.findByText('+10.00');
    expect(total).toHaveClass('pos');
  });
});
