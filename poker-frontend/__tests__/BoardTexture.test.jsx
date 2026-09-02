import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardTexture } from '../src/pages/Stats/BoardTexture.jsx';

// Matches statsEngine.js's finalizeBoardTextureMap() shape (a tag bucket has
// contexts; a context bucket has handClasses - both also carry actionMix/
// sizing alongside the usual profit fields).
function profitBucket(overrides) {
  return { hands: 10, totalProfitLoss: 50, handsWithProfitData: 10, bb100: 12.3, currency: 'USD', ...overrides };
}

function actionMix(overrides) {
  return {
    total: 10,
    bet: { count: 0, pct: 0 },
    check: { count: 0, pct: 0 },
    raise: { count: 0, pct: 0 },
    call: { count: 0, pct: 0 },
    fold: { count: 0, pct: 0 },
    ...overrides
  };
}

function sizing(overrides) {
  return { avgPotPct: null, sampleSize: 0, ...overrides };
}

function byBoardTextureFixture() {
  return {
    monotone: {
      ...profitBucket(),
      actionMix: actionMix({ bet: { count: 6, pct: 60 }, check: { count: 4, pct: 40 } }),
      sizing: sizing({ avgPotPct: 65, sampleSize: 6 }),
      contexts: {
        open: {
          ...profitBucket({ hands: 8, totalProfitLoss: 40, handsWithProfitData: 8, bb100: 18 }),
          actionMix: actionMix({ total: 8, bet: { count: 5, pct: 62.5 }, check: { count: 3, pct: 37.5 } }),
          sizing: sizing({ avgPotPct: 55, sampleSize: 5 }),
          handClasses: {
            AKs: profitBucket({ hands: 5, totalProfitLoss: 25, handsWithProfitData: 5, bb100: 2.5 }),
            QQ: profitBucket({ hands: 3, totalProfitLoss: 15, handsWithProfitData: 3, bb100: 5 })
          }
        },
        threeBet: {
          ...profitBucket({ hands: 2, totalProfitLoss: 10, handsWithProfitData: 2, bb100: 40 }),
          actionMix: actionMix({ total: 2, bet: { count: 1, pct: 50 }, check: { count: 1, pct: 50 } }),
          sizing: sizing({ avgPotPct: 75, sampleSize: 1 }),
          handClasses: {
            JJ: profitBucket({ hands: 2, totalProfitLoss: 10, handsWithProfitData: 2, bb100: 40 })
          }
        }
      }
    }
  };
}

function detailPanel() {
  return document.querySelector('.bt-detail-panel');
}

describe('BoardTexture', () => {
  it('renders nothing when there is no texture data', () => {
    const { container } = render(<BoardTexture byBoardTexture={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the prop is missing entirely', () => {
    const { container } = render(<BoardTexture />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a tag row with its hands/net $/bb100, collapsed by default', () => {
    render(<BoardTexture byBoardTexture={byBoardTextureFixture()} />);
    expect(screen.getByText('Monotone')).toBeInTheDocument();
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('expands a tag to show its preflop-context rows on click', async () => {
    const user = userEvent.setup();
    render(<BoardTexture byBoardTexture={byBoardTextureFixture()} />);

    await user.click(screen.getByText('Monotone'));

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('3-Bet')).toBeInTheDocument();
    expect(detailPanel()).not.toBeInTheDocument();
  });

  it('clicking a context row opens the detail panel with action mix, sizing, and hand classes', async () => {
    const user = userEvent.setup();
    render(<BoardTexture byBoardTexture={byBoardTextureFixture()} />);

    await user.click(screen.getByText('Monotone'));
    await user.click(screen.getByText('Open'));

    const panel = within(detailPanel());
    expect(panel.getByText('Monotone')).toBeInTheDocument();
    expect(panel.getByText('Open')).toBeInTheDocument();
    expect(panel.getByText('62.5%')).toBeInTheDocument();
    expect(panel.getByText('55% pot')).toBeInTheDocument();
    expect(panel.getByText('AKs')).toBeInTheDocument();
    expect(panel.getByText('QQ')).toBeInTheDocument();
  });

  it('closes the detail panel when clicking the same context row again', async () => {
    const user = userEvent.setup();
    render(<BoardTexture byBoardTexture={byBoardTextureFixture()} />);

    await user.click(screen.getByText('Monotone'));
    await user.click(screen.getByText('Open'));
    expect(detailPanel()).toBeInTheDocument();

    // "Open" also appears in the panel's summary column once it's open -
    // the table row (the clickable toggle) is always the first match.
    await user.click(screen.getAllByText('Open')[0]);
    expect(detailPanel()).not.toBeInTheDocument();
  });
});
