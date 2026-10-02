import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreflopMatrixControls } from '../src/pages/Stats/PreflopMatrix/PreflopMatrixControls.jsx';
import { statsFixture, mockFetch, renderStudy } from './helpers/heroStats.jsx';

// Matches PreflopMatrixPage.jsx's `nodes` shape: a committed step carries
// its `action` and its index in the path, an open seat doesn't.
function decided(position, action, index, scenario = 'rfi', facingPosition = null) {
  return { id: `step-${index}`, index, decided: true, position, action, scenario, facingPosition };
}
function open(position, scenario = 'rfi', facingPosition = null) {
  return { id: `open-${position}`, decided: false, position, scenario, facingPosition };
}

function renderControls(overrides = {}) {
  const props = {
    nodes: [open('UTG'), open('HJ'), open('CO')],
    activeId: 'open-UTG',
    complete: false,
    onSelectNode: vi.fn(),
    onPickAction: vi.fn(),
    onReset: vi.fn(),
    tableSize: 6, setTableSize: vi.fn(),
    ...overrides
  };
  render(<PreflopMatrixControls {...props} />);
  return props;
}

// The card for `position`, found via its title button rather than a test id.
function card(position) {
  return screen.getByRole('button', { name: position }).closest('.pfm-node-card');
}

describe('PreflopMatrixControls: node cards are selectable', () => {
  it('renders one card per node, decided seats included', () => {
    renderControls({ nodes: [decided('UTG', 'raise', 0), open('HJ', 'vsOpen', 'UTG')] });
    expect(card('UTG')).toBeInTheDocument();
    expect(card('HJ')).toBeInTheDocument();
  });

  it('selects a node when its position title is clicked', async () => {
    const props = renderControls();
    await userEvent.click(screen.getByRole('button', { name: 'CO' }));
    expect(props.onSelectNode).toHaveBeenCalledWith('open-CO');
    expect(props.onPickAction).not.toHaveBeenCalled();
  });

  it('selects a node when the card body around the title is clicked', async () => {
    const props = renderControls();
    await userEvent.click(card('HJ'));
    expect(props.onSelectNode).toHaveBeenCalledWith('open-HJ');
    expect(props.onPickAction).not.toHaveBeenCalled();
  });

  // The two click targets have to stay independent: committing an action is
  // a change to the line, selecting is only a change to what's on screen.
  it('commits an action without selecting when an action row is clicked', async () => {
    const nodes = [open('UTG'), open('HJ'), open('CO')];
    const props = renderControls({ nodes });
    await userEvent.click(within(card('CO')).getByRole('button', { name: /Raise/ }));
    expect(props.onPickAction).toHaveBeenCalledWith(nodes[2], 'raise');
    expect(props.onSelectNode).not.toHaveBeenCalled();
  });

  it('marks exactly one card as the selected one', () => {
    renderControls({ nodes: [open('UTG'), open('HJ'), open('CO')], activeId: 'open-HJ' });
    expect(screen.getByRole('button', { name: 'HJ' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'UTG' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'CO' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('re-decides an already-committed step from its own card', async () => {
    const nodes = [decided('UTG', 'raise', 0), open('HJ', 'vsOpen', 'UTG')];
    const props = renderControls({ nodes, activeId: 'open-HJ' });
    await userEvent.click(within(card('UTG')).getByRole('button', { name: /Fold/ }));
    expect(props.onPickAction).toHaveBeenCalledWith(nodes[0], 'fold');
  });
});

describe('PreflopMatrixControls: node cards show hero\'s frequencies', () => {
  it('shows each action\'s frequency and the hand count behind them', () => {
    const summary = { fold: 30, call: 0, raise: 10, total: 40, foldPct: 75, callPct: 0, raisePct: 25 };
    renderControls({ nodes: [{ ...open('UTG'), summary }, open('HJ')] });

    expect(within(card('UTG')).getByRole('button', { name: 'Fold 75%' })).toBeInTheDocument();
    expect(within(card('UTG')).getByRole('button', { name: 'Call 0%' })).toBeInTheDocument();
    expect(within(card('UTG')).getByRole('button', { name: 'Raise 25%' })).toBeInTheDocument();
    expect(within(card('UTG')).getByText('40 hands')).toBeInTheDocument();
  });

  // A spot hero has never been in has no frequencies - "0%" would claim
  // hero never took the action there, which the data doesn't say.
  it('marks a node with no hands as having no data rather than 0%', () => {
    const empty = { fold: 0, call: 0, raise: 0, total: 0, foldPct: 0, callPct: 0, raisePct: 0 };
    renderControls({ nodes: [{ ...open('UTG'), summary: empty }, open('HJ')] });

    for (const position of ['UTG', 'HJ']) {
      expect(within(card(position)).getByRole('button', { name: 'Raise —' })).toBeInTheDocument();
      expect(within(card(position)).getByText('No hands')).toBeInTheDocument();
    }
  });
});

// End-to-end through the real page: selecting a card has to actually
// re-point the range grid, which is the whole reason the cards are
// clickable.
describe('PreflopMatrixPage: the selected card drives the grid', () => {
  function cell(token, { fold, call, raise }) {
    const total = fold + call + raise;
    const pct = n => Math.round((n / total) * 1000) / 10;
    return { fold, call, raise, total, foldPct: pct(fold), callPct: pct(call), raisePct: pct(raise), confidence: 'high' };
  }

  beforeEach(() => {
    mockFetch({
      ...statsFixture(),
      // Two seats with deliberately different sample sizes, so the side
      // panel's "n = " readout says which seat's slice the grid is showing.
      preflopMatrix: {
        6: {
          rfi: {
            UTG: { AA: cell('AA', { fold: 0, call: 0, raise: 11 }) },
            CO: { AA: cell('AA', { fold: 0, call: 0, raise: 47 }) }
          }
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens on UTG and switches to CO when CO\'s card is clicked', async () => {
    renderStudy('/study/range-matrix');
    await waitFor(() => expect(screen.getByText(/UTG · RFI/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'CO' }));
    expect(screen.getByText(/CO · RFI/)).toBeInTheDocument();
    // The line itself is untouched - CO is still an undecided seat, so
    // every seat's card is still on screen.
    expect(screen.getByRole('button', { name: 'UTG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BB' })).toBeInTheDocument();
  });

  it('shows each seat\'s own frequencies and hand count on its line card', async () => {
    renderStudy('/study/range-matrix');
    await waitFor(() => expect(screen.getByText(/UTG · RFI/)).toBeInTheDocument());

    expect(within(card('UTG')).getByRole('button', { name: 'Raise 100%' })).toBeInTheDocument();
    expect(within(card('UTG')).getByText('11 hands')).toBeInTheDocument();
    expect(within(card('CO')).getByText('47 hands')).toBeInTheDocument();
    expect(within(card('HJ')).getByText('No hands')).toBeInTheDocument();
  });
});

describe('PreflopMatrixPage: side panel', () => {
  function cell({ fold, call, raise }) {
    const total = fold + call + raise;
    const pct = n => Math.round((n / total) * 1000) / 10;
    return { fold, call, raise, total, foldPct: pct(fold), callPct: pct(call), raisePct: pct(raise), confidence: 'high' };
  }

  beforeEach(() => {
    mockFetch({
      ...statsFixture(),
      preflopMatrix: {
        6: {
          rfi: {
            UTG: { AA: cell({ fold: 0, call: 0, raise: 11 }), '72o': cell({ fold: 9, call: 0, raise: 0 }) },
            CO: { AA: cell({ fold: 0, call: 0, raise: 47 }) }
          }
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderPage() {
    renderStudy('/study/range-matrix');
    await waitFor(() => expect(screen.getByText(/UTG · RFI/)).toBeInTheDocument());
    return {
      grid: document.querySelector('.hand-matrix'),
      panel: document.querySelector('.pfm-panel')
    };
  }

  it('summarises the selected spot across every hand in it', async () => {
    const { panel } = await renderPage();

    // UTG: 11 AA raises + 9 72o folds.
    expect(within(panel).getByText('20 hands')).toBeInTheDocument();
    expect(within(panel).getByText('55.0%')).toBeInTheDocument(); // raise
    expect(within(panel).getByText('45.0%')).toBeInTheDocument(); // fold
  });

  it('reads out the hovered hand, and keeps a clicked one pinned until unpinned', async () => {
    const user = userEvent.setup();
    const { grid, panel } = await renderPage();
    const aa = within(grid).getByText('AA');

    await user.hover(aa);
    expect(within(panel).getByText('AA')).toBeInTheDocument();
    expect(within(panel).getByText(/n = 11/)).toBeInTheDocument();

    await user.hover(panel);
    expect(within(panel).queryByText('AA')).not.toBeInTheDocument();
    expect(within(panel).getByText(/Hover a hand/)).toBeInTheDocument();

    await user.click(aa);
    expect(aa.closest('.hm-cell')).toHaveClass('hm-cell--pinned');
    await user.hover(panel);
    expect(within(panel).getByText('AA')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: /Unpin/ }));
    expect(within(panel).queryByText('AA')).not.toBeInTheDocument();
    expect(aa.closest('.hm-cell')).not.toHaveClass('hm-cell--pinned');
  });

  // The point of pinning: follow one hand from seat to seat.
  it('keeps the pinned hand across a change of selected seat', async () => {
    const user = userEvent.setup();
    const { grid, panel } = await renderPage();

    await user.click(within(grid).getByText('AA'));
    await user.click(screen.getByRole('button', { name: 'CO' }));

    expect(within(panel).getByText('CO · RFI')).toBeInTheDocument();
    expect(within(panel).getByText('AA')).toBeInTheDocument();
    expect(within(panel).getByText(/n = 47/)).toBeInTheDocument();
  });

  it('hosts the min sample size setting', async () => {
    const { panel } = await renderPage();
    expect(within(panel).getByLabelText(/Min sample size/)).toHaveAttribute('type', 'range');
  });
});
