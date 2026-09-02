import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupedStats } from '../src/components/GroupedStats.jsx';

function rate(made, opportunities, confidence = 'high') {
  return { pct: opportunities > 0 ? Math.round((made / opportunities) * 1000) / 10 : 0, made, opportunities, confidence };
}

// Matches statsEngine.js's newGroupStats()/finalizeGroupStats() shape.
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

describe('GroupedStats', () => {
  it('renders nothing when every dimension is empty', () => {
    const { container } = render(<GroupedStats byStakes={{}} byStackDepth={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both props are missing entirely', () => {
    const { container } = render(<GroupedStats />);
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to the stakes tab and its first key when stakes data exists', () => {
    render(<GroupedStats byStakes={{ '$1/$2': groupBucket() }} byStackDepth={{}} />);
    expect(screen.getByRole('button', { name: 'Stakes' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '$1/$2' })).toHaveClass('active');
  });

  it('disables a dimension tab that has no data', () => {
    render(<GroupedStats byStakes={{ '$1/$2': groupBucket() }} byStackDepth={{}} />);
    expect(screen.getByRole('button', { name: 'Stack Depth' })).toBeDisabled();
  });

  it('falls back to the first dimension that DOES have data when stakes is empty', () => {
    render(<GroupedStats byStakes={{}} byStackDepth={{ short: groupBucket() }} />);
    expect(screen.getByRole('button', { name: 'Stack Depth' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Short (<40bb)' })).toHaveClass('active');
  });

  it('shows Net Won and BB/100 for a stakes bucket', () => {
    render(<GroupedStats byStakes={{ '$1/$2': groupBucket({ totalProfitLoss: 42.5, bb100: 8.5 }) }} byStackDepth={{}} />);
    expect(screen.getByText('+$42.50')).toBeInTheDocument();
    expect(screen.getByText('8.5')).toBeInTheDocument();
  });

  it('switching the dimension tab switches which bucket is shown', async () => {
    const user = userEvent.setup();
    render(
      <GroupedStats
        byStakes={{ '$1/$2': groupBucket({ totalProfitLoss: 10, bb100: 1 }) }}
        byStackDepth={{ short: groupBucket({ totalProfitLoss: 99, bb100: 5 }) }}
      />
    );
    expect(screen.getByText('+$10.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stack Depth' }));
    expect(screen.getByRole('button', { name: 'Stack Depth' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Short (<40bb)' })).toHaveClass('active');
    expect(screen.getByText('+$99.00')).toBeInTheDocument();
    expect(screen.queryByText('+$10.00')).not.toBeInTheDocument();
  });

  it('switching the key tab within a dimension switches the displayed values', async () => {
    const user = userEvent.setup();
    render(
      <GroupedStats
        byStakes={{
          '$1/$2': groupBucket({ totalProfitLoss: 10, handsWithProfitData: 10 }),
          '$2/$5': groupBucket({ totalProfitLoss: 99, handsWithProfitData: 20 })
        }}
        byStackDepth={{}}
      />
    );
    expect(screen.getByText('+$10.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '$2/$5' }));
    expect(screen.getByText('+$99.00')).toBeInTheDocument();
    expect(screen.queryByText('+$10.00')).not.toBeInTheDocument();
  });

  it('labels stack-depth keys with their bb range, not the raw bucket name', () => {
    render(<GroupedStats byStakes={{}} byStackDepth={{ short: groupBucket(), deep: groupBucket() }} />);
    expect(screen.getByRole('button', { name: 'Short (<40bb)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deep (>100bb)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'short' })).not.toBeInTheDocument();
  });

  it('falls back to the raw stakes string as the key label (no relabeling needed)', () => {
    render(<GroupedStats byStakes={{ '$0.5/$1': groupBucket() }} byStackDepth={{}} />);
    expect(screen.getByRole('button', { name: '$0.5/$1' })).toBeInTheDocument();
  });

  it('shows "no data" for a stat with zero opportunities', () => {
    render(<GroupedStats byStakes={{ '$1/$2': groupBucket({ threeBet: rate(0, 0) }) }} byStackDepth={{}} />);
    expect(screen.getByText('no data')).toBeInTheDocument();
  });

  it('shows the mixed-currencies fallback when a bucket has no single currency', () => {
    render(<GroupedStats byStakes={{ '$1/$2': groupBucket({ currency: null, totalProfitLoss: 7 }) }} byStackDepth={{}} />);
    expect(screen.getByText('+7 (mixed currencies)')).toBeInTheDocument();
  });

  it('applies the low-confidence modifier class to a low-confidence stat', () => {
    // 33.3% doesn't collide with any other default stat's percentage in
    // groupBucket(), so querying by text unambiguously finds this one box.
    render(<GroupedStats byStakes={{ '$1/$2': groupBucket({ vpip: rate(1, 3, 'low') }) }} byStackDepth={{}} />);
    const vpipValue = screen.getByText('33.3%');
    expect(vpipValue.closest('.stat-box')).toHaveClass('stat-box--low-confidence');
  });
});
