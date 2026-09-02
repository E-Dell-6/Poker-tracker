import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandClassBreakdown } from '../src/pages/Stats/HandClassBreakdown.jsx';

// Matches statsEngine.js's finalizeHandClassCategoryMap()/finalizeHandClassMap()
// shapes (category bucket has no `contexts`; a specific-hand bucket does,
// each context bucket carrying its own `byPosition`).
function profitBucket(overrides) {
  return { hands: 10, totalProfitLoss: 50, handsWithProfitData: 10, bb100: 12.3, currency: 'USD', ...overrides };
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
          ...profitBucket({ hands: 8, totalProfitLoss: 40, handsWithProfitData: 8, bb100: 18 }),
          byPosition: {
            BTN: profitBucket({ hands: 5, totalProfitLoss: 25, handsWithProfitData: 5, bb100: 2.5 }),
            CO: profitBucket({ hands: 3, totalProfitLoss: 15, handsWithProfitData: 3, bb100: 5 })
          }
        },
        fourBet: {
          ...profitBucket({ hands: 2, totalProfitLoss: 10, handsWithProfitData: 2, bb100: 40 }),
          byPosition: {
            BTN: profitBucket({ hands: 2, totalProfitLoss: 10, handsWithProfitData: 2, bb100: 40 })
          }
        }
      }
    }
  };
}

// The Biggest Leaks card above the table always renders a context <select>
// with an <option> per CONTEXT_ORDER entry ("Open", "4-Bet", ...) - the
// same text that appears in the table/detail panel once a hand is
// selected. Scope queries to the panel instead of a bare global getByText
// to avoid colliding with those options (every fixture here stays well
// under HandClassLeaks' 30-hand floor, so the leaks list itself is always
// empty - this is purely about the filter dropdown's static option list).
function detailPanel() {
  return document.querySelector('.hcb-detail-panel');
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
    expect(detailPanel()).not.toBeInTheDocument();
  });

  it('clicking a hand opens its detail panel with preflop contexts and position badges', async () => {
    const user = userEvent.setup();
    render(<HandClassBreakdown byHandClass={byHandClassFixture()} byHandClassCategory={byHandClassCategoryFixture()} />);

    await user.click(screen.getByText('Ax suited'));
    expect(detailPanel()).not.toBeInTheDocument();

    await user.click(screen.getByText('AKs'));

    const panel = within(detailPanel());
    expect(panel.getByText('Open')).toBeInTheDocument();
    expect(panel.getByText('4-Bet')).toBeInTheDocument();
    expect(panel.getByText('BTN +2.5')).toBeInTheDocument();
    expect(panel.getByText('CO +5.0')).toBeInTheDocument();
  });

  it('closes the detail panel when clicking the same hand again', async () => {
    const user = userEvent.setup();
    render(<HandClassBreakdown byHandClass={byHandClassFixture()} byHandClassCategory={byHandClassCategoryFixture()} />);

    await user.click(screen.getByText('Ax suited'));
    await user.click(screen.getByText('AKs'));
    expect(detailPanel()).toBeInTheDocument();

    // Once the panel is open, "AKs" also appears in its header - the table
    // row (the clickable toggle) is always the first match.
    await user.click(screen.getAllByText('AKs')[0]);
    expect(detailPanel()).not.toBeInTheDocument();
  });

  it('omits a context with no context data from the detail panel', async () => {
    const user = userEvent.setup();
    const byHandClass = byHandClassFixture();
    delete byHandClass.AKs.contexts.fourBet;
    render(<HandClassBreakdown byHandClass={byHandClass} byHandClassCategory={byHandClassCategoryFixture()} />);

    await user.click(screen.getByText('Ax suited'));
    await user.click(screen.getByText('AKs'));

    const panel = within(detailPanel());
    expect(panel.getByText('Open')).toBeInTheDocument();
    expect(panel.queryByText('4-Bet')).not.toBeInTheDocument();
  });
});
