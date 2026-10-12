import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandClassBreakdown } from '../src/pages/Stats/HandClassBreakdown.jsx';

function bucket(hands, bb100) {
  return { hands, bb100, totalProfitLoss: bb100, handsWithProfitData: hands, currency: 'USD' };
}

const CATEGORIES = { pocketPairs: bucket(100, 20), axSuited: bucket(50, -10) };
const HANDS = {
  AA: { ...bucket(100, 20), category: 'pocketPairs', contexts: { open: { ...bucket(100, 20), byPosition: { BTN: bucket(100, 20) } } } },
  AKs: { ...bucket(50, -10), category: 'axSuited', contexts: {} },
};

function renderBreakdown() {
  return render(<HandClassBreakdown byHandClass={HANDS} byHandClassCategory={CATEGORIES} />);
}

afterEach(() => {
  delete window.matchMedia;
});

describe('HandClassBreakdown layout', () => {
  it('draws win-rate bars scaled to the largest visible bb/100, negatives on the left', () => {
    renderBreakdown();
    const [best, worst] = document.querySelectorAll('.hcb-bar-fill');
    expect(best).toHaveClass('hcb-bar-fill--pos');
    expect(best.style.width).toBe('50%');      // the largest |bb/100| fills its half
    expect(worst).toHaveClass('hcb-bar-fill--neg');
    expect(worst.style.width).toBe('25%');     // 10 / 20 of a half
  });

  it('shows a placeholder beside the table until a hand is picked', () => {
    renderBreakdown();
    expect(screen.getByText(/Pick a hand to see how it plays/)).toBeInTheDocument();
    expect(document.querySelector('.hcb-detail-panel')).not.toBeInTheDocument();
  });

  it('opens the hand in a dialog on narrow screens', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const user = userEvent.setup();
    renderBreakdown();
    expect(screen.queryByText(/Pick a hand to see how it plays/)).not.toBeInTheDocument();

    await user.click(screen.getByText('Pocket pairs'));
    await user.click(screen.getByText('AA'));
    expect(screen.getByRole('dialog', { name: 'AA' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
