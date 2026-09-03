import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreflopPositionMatrix } from '../src/pages/Stats/PreflopPositionMatrix.jsx';
import { PostflopPositionMatrix } from '../src/pages/Stats/PostflopPositionMatrix.jsx';

function rate(made, opportunities) {
  return { pct: opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0, made, opportunities, confidence: 'high' };
}

// Matches statsEngine.js's finalizePositionStats() shape - RatePct tolerates
// missing keys, so this doesn't need to be exhaustive.
function positionStats(overrides) {
  return {
    hands: 10, vpip: rate(5, 10), pfr: rate(4, 10), open: rate(3, 10),
    threeBet: rate(1, 5), foldTo3Bet: rate(1, 2), fourBet: rate(0, 1), foldTo4Bet: rate(0, 1),
    steal: rate(2, 4), foldToSteal: rate(1, 2), limp: rate(1, 10), coldCall: rate(1, 10),
    wtsd: rate(3, 5), wsd: rate(2, 3), bb100: 5,
    cbFlop: rate(2, 5), foldToCbFlop: rate(1, 3), cbTurn: rate(1, 2), cbRiver: rate(0, 1),
    checkRaise: rate(1, 5), donk: rate(0, 2), probe: rate(0, 1), wwsf: rate(3, 6), aggFactor: 2,
    ...overrides
  };
}

describe.each([
  [PreflopPositionMatrix, 'Preflop matrix by position'],
  [PostflopPositionMatrix, 'Postflop matrix by position']
])('%s', (Matrix, title) => {
  it('renders nothing when there are no positions', () => {
    const { container } = render(<Matrix positional={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows its own section title', () => {
    const positional = { 6: { positions: { BTN: positionStats() } } };
    render(<Matrix positional={positional} />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('does not show a size-tab row when only one table size exists', () => {
    const positional = { 6: { positions: { BTN: positionStats() } } };
    render(<Matrix positional={positional} />);
    expect(screen.queryByRole('button', { name: /-handed/ })).not.toBeInTheDocument();
  });

  it('defaults to the most-played table size, not the largest', () => {
    const positional = {
      6: { positions: { BTN: positionStats({ hands: 84 }) } },
      9: { positions: { CO: positionStats({ hands: 1 }) } }
    };
    render(<Matrix positional={positional} />);
    expect(screen.getByRole('button', { name: '6-handed (84)' })).toHaveClass('active');
    expect(screen.getByText('BTN')).toBeInTheDocument();
    expect(screen.queryByText('CO')).not.toBeInTheDocument();
  });

  it('switching the size tab swaps the displayed rows', async () => {
    const user = userEvent.setup();
    const positional = {
      6: { positions: { BTN: positionStats({ hands: 84 }) } },
      9: { positions: { CO: positionStats({ hands: 1 }) } }
    };
    render(<Matrix positional={positional} />);

    await user.click(screen.getByRole('button', { name: '9-handed (1)' }));

    expect(screen.getByText('CO')).toBeInTheDocument();
    expect(screen.queryByText('BTN')).not.toBeInTheDocument();
  });
});
