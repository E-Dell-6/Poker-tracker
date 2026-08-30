import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandClassBreakdown } from '../src/pages/Stats/HandClassBreakdown.jsx';

// Matches statsEngine.js's finalizeHandClassCategoryMap()/finalizeHandClassMap()
// shapes (category bucket has no `contexts`; a specific-hand bucket does,
// each context bucket carrying its own `byPosition`).
function profitBucket(overrides) {
  return { hands: 10, totalProfitLoss: 50, handsWithProfitData: 10, currency: 'USD', ...overrides };
}

function byHandClassCategoryFixture() {
  return { axSuited: profitBucket() };
}

function byHandClassFixture() {
  return {
    AKs: {
      ...profitBucket(),
      category: 'axSuited',
      contexts: {
        open: {
          ...profitBucket({ hands: 8, totalProfitLoss: 40, handsWithProfitData: 8 }),
          byPosition: {
            BTN: profitBucket({ hands: 5, totalProfitLoss: 25, handsWithProfitData: 5 }),
            CO: profitBucket({ hands: 3, totalProfitLoss: 15, handsWithProfitData: 3 })
          }
        },
        fourBet: {
          ...profitBucket({ hands: 2, totalProfitLoss: 10, handsWithProfitData: 2 }),
          byPosition: {
            BTN: profitBucket({ hands: 2, totalProfitLoss: 10, handsWithProfitData: 2 })
          }
        }
      }
    }
  };
}

describe('HandClassBreakdown', () => {
  it('renders nothing when there is no category data', () => {
    const { container } = render(<HandClassBreakdown byHandClass={{}} byHandClassCategory={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both props are missing entirely', () => {
    const { container } = render(<HandClassBreakdown />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a category row with its net $ won, collapsed by default', () => {
    render(<HandClassBreakdown byHandClass={byHandClassFixture()} byHandClassCategory={byHandClassCategoryFixture()} />);
    expect(screen.getByText('Ax suited')).toBeInTheDocument();
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.queryByText('AKs')).not.toBeInTheDocument();
  });

  it('shows n/a for a bucket with hands but no profit data, not a misleading $0.00', () => {
    const byHandClassCategory = { axSuited: profitBucket({ totalProfitLoss: 0, handsWithProfitData: 0 }) };
    render(<HandClassBreakdown byHandClass={byHandClassFixture()} byHandClassCategory={byHandClassCategory} />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });

  it('expands a category to show its specific hands on click', async () => {
    const user = userEvent.setup();
    render(<HandClassBreakdown byHandClass={byHandClassFixture()} byHandClassCategory={byHandClassCategoryFixture()} />);

    await user.click(screen.getByText('Ax suited'));

    expect(screen.getByText('AKs')).toBeInTheDocument();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('expands a hand to show its preflop contexts, then a context to show its positions', async () => {
    const user = userEvent.setup();
    render(<HandClassBreakdown byHandClass={byHandClassFixture()} byHandClassCategory={byHandClassCategoryFixture()} />);

    await user.click(screen.getByText('Ax suited'));
    await user.click(screen.getByText('AKs'));

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('4-Bet')).toBeInTheDocument();
    expect(screen.queryByText('BTN')).not.toBeInTheDocument();

    await user.click(screen.getByText('Open'));

    expect(screen.getByText('BTN')).toBeInTheDocument();
    expect(screen.getByText('CO')).toBeInTheDocument();
    // The 4-Bet context's own position rows stay collapsed independently.
    expect(screen.getAllByText('BTN')).toHaveLength(1);
  });

  it('omits a context with no context data from the drill-down', async () => {
    const user = userEvent.setup();
    const byHandClass = byHandClassFixture();
    delete byHandClass.AKs.contexts.fourBet;
    render(<HandClassBreakdown byHandClass={byHandClass} byHandClassCategory={byHandClassCategoryFixture()} />);

    await user.click(screen.getByText('Ax suited'));
    await user.click(screen.getByText('AKs'));

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('4-Bet')).not.toBeInTheDocument();
  });
});
