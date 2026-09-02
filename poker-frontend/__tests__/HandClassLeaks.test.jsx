import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandClassLeaks } from '../src/pages/Stats/HandClassLeaks.jsx';

// Matches statsEngine.js's finalizeHandClassMap() shape for one context
// bucket within byHandClass[token].contexts.
function ctxBucket(overrides) {
  return { hands: 40, totalProfitLoss: -50, handsWithProfitData: 40, bb100: -20, currency: 'USD', byPosition: {}, ...overrides };
}

// The context <select> always renders an <option> per CONTEXT_ORDER entry
// ("Open", "3-Bet", ...) - the same text a leak row's context tag shows -
// so context-label assertions are scoped to the leak list, not the whole
// document, to avoid an ambiguous multi-match.
function leakList() {
  return document.querySelector('.hcl-list');
}

describe('HandClassLeaks', () => {
  it('shows the "not enough data" empty state when no hand/action combo clears the sample floor', () => {
    const byHandClass = {
      AKs: { category: 'axSuited', contexts: { open: ctxBucket({ hands: 10, totalProfitLoss: -20, handsWithProfitData: 10 }) } }
    };
    render(<HandClassLeaks byHandClass={byHandClass} onSelectHand={() => {}} />);

    expect(screen.getByText(/Not enough hands yet/)).toBeInTheDocument();
  });

  it('shows the "no losing spots" empty state when qualifying combos are all break-even or profitable', () => {
    const byHandClass = {
      AKs: { category: 'axSuited', contexts: { open: ctxBucket({ hands: 40, totalProfitLoss: 30, handsWithProfitData: 40, bb100: 12 }) } }
    };
    render(<HandClassLeaks byHandClass={byHandClass} onSelectHand={() => {}} />);

    expect(screen.getByText(/No losing spots found/)).toBeInTheDocument();
  });

  it('lists a qualifying losing combo, with its position breakdown as inline badges', () => {
    const byHandClass = {
      AKs: {
        category: 'axSuited',
        contexts: {
          open: ctxBucket({
            hands: 40, totalProfitLoss: -80, handsWithProfitData: 40, bb100: -25,
            byPosition: { BTN: ctxBucket({ hands: 40, totalProfitLoss: -80, handsWithProfitData: 40, bb100: -25 }) }
          })
        }
      }
    };
    render(<HandClassLeaks byHandClass={byHandClass} onSelectHand={() => {}} />);

    expect(screen.getByText('AKs')).toBeInTheDocument();
    expect(within(leakList()).getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('BTN -25.0')).toBeInTheDocument();
  });

  it('sorts leaks worst net-$-loss first', () => {
    const byHandClass = {
      AKs: { category: 'axSuited', contexts: { open: ctxBucket({ hands: 40, totalProfitLoss: -30 }) } },
      QQ: { category: 'pocketPairs', contexts: { open: ctxBucket({ hands: 40, totalProfitLoss: -300 }) } }
    };
    render(<HandClassLeaks byHandClass={byHandClass} onSelectHand={() => {}} />);

    const tokens = screen.getAllByText(/^(AKs|QQ)$/).map(el => el.textContent);
    expect(tokens).toEqual(['QQ', 'AKs']);
  });

  it('excludes a combo below the 30-hand sample floor even if it is losing', () => {
    const byHandClass = {
      AKs: { category: 'axSuited', contexts: { open: ctxBucket({ hands: 29, totalProfitLoss: -900 }) } }
    };
    render(<HandClassLeaks byHandClass={byHandClass} onSelectHand={() => {}} />);

    expect(screen.getByText(/Not enough hands yet/)).toBeInTheDocument();
  });

  it('filters to a single context via the select', async () => {
    const user = userEvent.setup();
    const byHandClass = {
      AKs: {
        category: 'axSuited',
        contexts: {
          open: ctxBucket({ hands: 40, totalProfitLoss: -30 }),
          threeBet: ctxBucket({ hands: 40, totalProfitLoss: -60 })
        }
      }
    };
    render(<HandClassLeaks byHandClass={byHandClass} onSelectHand={() => {}} />);

    expect(within(leakList()).getByText('Open')).toBeInTheDocument();
    expect(within(leakList()).getByText('3-Bet')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter leaks by preflop action'), 'open');

    expect(within(leakList()).getByText('Open')).toBeInTheDocument();
    expect(within(leakList()).queryByText('3-Bet')).not.toBeInTheDocument();
  });

  it('calls onSelectHand with the leak\'s hand token when clicked', async () => {
    const user = userEvent.setup();
    const onSelectHand = vi.fn();
    const byHandClass = {
      AKs: { category: 'axSuited', contexts: { open: ctxBucket({ hands: 40, totalProfitLoss: -30 }) } }
    };
    render(<HandClassLeaks byHandClass={byHandClass} onSelectHand={onSelectHand} />);

    await user.click(screen.getByText('AKs'));

    expect(onSelectHand).toHaveBeenCalledWith('AKs');
  });
});
