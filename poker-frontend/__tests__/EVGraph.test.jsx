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

  it('renders nothing while the initial fetch is in flight', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})); // never resolves
    const { container } = render(<EVGraph />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches from the ev-graph endpoint with credentials included', () => {
    mockFetchOnce([]);
    render(<EVGraph />);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/stats/me/ev-graph'),
      expect.objectContaining({ credentials: 'include' })
    );
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
