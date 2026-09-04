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
    minSampleSize: 0, setMinSampleSize: vi.fn(),
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
      // Two seats with deliberately different sample sizes, so the tooltip
      // "n = " readout says which seat's slice the grid is showing.
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
});
