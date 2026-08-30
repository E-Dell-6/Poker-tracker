import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudyCharts } from '../src/pages/Stats/StudyCharts.jsx';

function rate(made, opportunities) {
  return { pct: opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0, made, opportunities, confidence: 'high' };
}

// Matches statsEngine.js's finalizePositionStats() shape closely enough for
// the position-keyed charts to render (recharts' own SVG output doesn't
// render in jsdom without real layout - see EVGraph.test.jsx - so these
// tests only check the DOM text StudyCharts itself controls: card headers,
// the size-tab row, and the "N-handed" sub-label).
function positionStats(overrides) {
  return {
    hands: 10, bb100: 5,
    vpip: rate(5, 10), pfr: rate(4, 10), open: rate(3, 10),
    cbFlop: rate(2, 5), foldToCbFlop: rate(1, 3),
    ...overrides
  };
}

describe('StudyCharts', () => {
  it('renders nothing when there is no positional or showdown data', () => {
    const { container } = render(<StudyCharts positional={{}} showdownBreakdown={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not show a size-tab row when only one table size exists', () => {
    const positional = { 6: { positions: { BTN: positionStats() }, vsOpen: {}, vs3Bet: {} } };
    render(<StudyCharts positional={positional} showdownBreakdown={{}} />);
    expect(screen.queryByRole('button', { name: /-handed/ })).not.toBeInTheDocument();
    expect(screen.getByText('Win rate by position')).toBeInTheDocument();
  });

  it('defaults to the most-played table size, not the largest', () => {
    // 9-handed is the larger table, but only 1 hand was played there - the
    // old "always pick the largest size" default would have hidden the
    // other 80 hands entirely instead of just defaulting elsewhere.
    const positional = {
      6: { positions: { BTN: positionStats({ hands: 80 }) }, vsOpen: {}, vs3Bet: {} },
      9: { positions: { CO: positionStats({ hands: 1 }) }, vsOpen: {}, vs3Bet: {} }
    };
    render(<StudyCharts positional={positional} showdownBreakdown={{}} />);
    expect(screen.getByRole('button', { name: '6-handed (80)' })).toHaveClass('active');
    expect(screen.getByText('bb / 100 hands · 6-handed')).toBeInTheDocument();
  });

  it('switching the size tab updates which table size is shown', async () => {
    const user = userEvent.setup();
    const positional = {
      6: { positions: { BTN: positionStats({ hands: 80 }) }, vsOpen: {}, vs3Bet: {} },
      9: { positions: { CO: positionStats({ hands: 1 }) }, vsOpen: {}, vs3Bet: {} }
    };
    render(<StudyCharts positional={positional} showdownBreakdown={{}} />);

    await user.click(screen.getByRole('button', { name: '9-handed (1)' }));

    expect(screen.getByRole('button', { name: '9-handed (1)' })).toHaveClass('active');
    expect(screen.getByText('bb / 100 hands · 9-handed')).toBeInTheDocument();
  });
});
