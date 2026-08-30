import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PositionalStats } from '../src/components/PositionalStats.jsx';

function rate(made, opportunities, confidence = 'high') {
  return { pct: opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0, made, opportunities, confidence };
}

const POSITION_KEYS = ['vpip', 'pfr', 'open', 'steal', 'threeBet', 'foldTo3Bet', 'fourBet', 'foldTo4Bet', 'cbFlop', 'foldToCbFlop', 'wtsd', 'wwsf'];

// Fills every POSITION_COLUMNS key with a default rate, then applies
// overrides. `hands` defaults to 10 (matching finalizePositionStats()'
// real shape, which always has a top-level `hands` count) so
// bucketHandCount()-driven behavior (the table-size tab labels/default)
// has something meaningful to sum across every existing fixture here.
function positionStats(overrides = {}) {
  const base = { hands: 10 };
  for (const key of POSITION_KEYS) base[key] = rate(5, 10);
  return { ...base, ...overrides };
}

function vsStat(faced, folded, called, raised, confidence = 'high') {
  const pct = n => (faced > 0 ? Math.round((n / faced) * 1000) / 10 : 0);
  return { faced, folded, called, raised, foldPct: pct(folded), callPct: pct(called), raisePct: pct(raised), defendPct: pct(called + raised), confidence };
}

function bucket({ positions = {}, vsOpen = {}, vs3Bet = {} } = {}) {
  return { positions, vsOpen, vs3Bet };
}

describe('PositionalStats', () => {
  it('shows a generic empty-state message when there is no positional data at all', () => {
    render(<PositionalStats positional={{}} coverage={{ hands: 0, totalHands: 0 }} />);
    expect(screen.getByText(/Not enough hands with identifiable seating/i)).toBeInTheDocument();
  });

  it('shows a data/import-issue message when hands exist but none resolved a position', () => {
    render(<PositionalStats positional={{}} coverage={{ hands: 0, totalHands: 50 }} />);
    expect(screen.getByText(/missing the button flag/i)).toBeInTheDocument();
  });

  it('shows a "hit recompute" message when some hands resolved but not all', () => {
    render(<PositionalStats positional={{}} coverage={{ hands: 20, totalHands: 50 }} />);
    expect(screen.getByText(/Hit Recompute/i)).toBeInTheDocument();
  });

  it('defaults to the largest table size when hand counts tie', () => {
    const positional = {
      6: bucket({ positions: { BTN: positionStats() } }),
      9: bucket({ positions: { BTN: positionStats() } })
    };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);
    expect(screen.getByRole('button', { name: '9-handed (10)' })).toHaveClass('active');
  });

  it('defaults to the most-played size, not the largest, when they differ', () => {
    // 9-handed is the larger table, but only 1 of the 51 total hands was
    // played there - the old "always pick the largest size" behavior would
    // silently hide the other 50 hands. See StudyCharts.jsx's identical fix.
    const positional = {
      6: bucket({ positions: { BTN: positionStats({ hands: 50 }) } }),
      9: bucket({ positions: { CO: positionStats({ hands: 1 }) } })
    };
    render(<PositionalStats positional={positional} coverage={{ hands: 51, totalHands: 51 }} />);
    expect(screen.getByRole('button', { name: '6-handed (50)' })).toHaveClass('active');
    expect(screen.getByRole('columnheader', { name: 'BTN' })).toBeInTheDocument();
  });

  it('switching the size tab switches the displayed position rows', async () => {
    const user = userEvent.setup();
    const positional = {
      6: bucket({ positions: { BTN: positionStats() } }),
      9: bucket({ positions: { CO: positionStats() } })
    };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);

    expect(screen.getByRole('columnheader', { name: 'CO' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'BTN' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '6-handed (10)' }));
    expect(screen.getByRole('columnheader', { name: 'BTN' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'CO' })).not.toBeInTheDocument();
  });

  it('renders "—" with no confidence styling for a position stat with zero opportunities', () => {
    const positional = { 6: bucket({ positions: { BTN: positionStats({ vpip: rate(0, 0) }) } }) };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);
    const emptyCells = screen.getAllByText('—');
    expect(emptyCells.length).toBeGreaterThan(0);
    expect(emptyCells[0].closest('td')).toHaveClass('pos-cell--empty');
  });

  it('applies the low-confidence modifier class to a low-confidence position stat', () => {
    // 33.3% (1/3) is distinct from the 50% (5/10) every other column defaults to.
    const positional = { 6: bucket({ positions: { BTN: positionStats({ vpip: rate(1, 3, 'low') }) } }) };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);
    const cell = screen.getByText('33.3%');
    expect(cell.closest('td')).toHaveClass('pos-cell--low-confidence');
  });

  it('does not render a vsOpen/vs3Bet matrix when it has no data', () => {
    const positional = { 6: bucket({ positions: { BTN: positionStats() }, vsOpen: {}, vs3Bet: {} }) };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);
    expect(screen.queryByText('Facing an Open')).not.toBeInTheDocument();
    expect(screen.queryByText('Facing a 3-Bet')).not.toBeInTheDocument();
  });

  it('renders the vsOpen matrix and defaults to Defend %', () => {
    const positional = {
      6: bucket({
        positions: { BTN: positionStats(), BB: positionStats() },
        vsOpen: { BTN: { BB: vsStat(10, 4, 3, 3) } }
      })
    };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);
    expect(screen.getByText('Facing an Open')).toBeInTheDocument();
    // defendPct = (3 called + 3 raised) / 10 faced = 60%
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('switching the matrix mode changes the displayed percentage', async () => {
    const user = userEvent.setup();
    const positional = {
      6: bucket({
        positions: { BTN: positionStats(), BB: positionStats() },
        vsOpen: { BTN: { BB: vsStat(10, 4, 3, 3) } }
      })
    };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);

    expect(screen.getByText('60%')).toBeInTheDocument(); // defend, default

    await user.click(screen.getByRole('button', { name: 'Fold %' }));
    // foldPct = 4/10 = 40%
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.queryByText('60%')).not.toBeInTheDocument();
  });

  it('applies the low-confidence modifier class to a low-confidence matrix cell', () => {
    const positional = {
      6: bucket({
        positions: { BTN: positionStats(), BB: positionStats() },
        vsOpen: { BTN: { BB: vsStat(10, 4, 3, 3, 'low') } }
      })
    };
    render(<PositionalStats positional={positional} coverage={{ hands: 10, totalHands: 10 }} />);
    const cell = screen.getByText('60%');
    expect(cell.closest('td')).toHaveClass('pos-cell--low-confidence');
  });
});
