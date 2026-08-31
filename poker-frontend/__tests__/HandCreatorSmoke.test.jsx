import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HandCreator from '../src/pages/HandCreator/HandCreator.jsx';

vi.mock('../src/api/people', () => ({
  getPeople: vi.fn().mockResolvedValue([]),
  createPerson: vi.fn(),
}));
vi.mock('../src/api/uploads', () => ({
  uploadImage: vi.fn(),
}));
vi.mock('../src/api/favourites', () => ({
  saveFavouriteHand: vi.fn().mockResolvedValue({ hands: [{ _id: 'h1' }] }),
}));

describe('HandCreator (redesigned) smoke test', () => {
  it('walks through all 3 steps without throwing', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/hand-creator']}>
        <HandCreator />
      </MemoryRouter>
    );

    // Step 1: table setup
    expect(screen.getByText('Set Up the Table')).toBeInTheDocument();
    const seats = container.querySelectorAll('.sc-seat');
    expect(seats.length).toBe(4);

    // seats[0] is the default dealer seat (already "Dealer ✓" / disabled) -
    // click seats[1] instead so "Set as Dealer" is actually clickable. Query
    // the popover's own buttons directly rather than screen.getByRole: the
    // seat wrapper itself also carries role="button" (it's clickable to open
    // the popover), so its computed accessible name includes the popover's
    // button text too and a substring match ambiguously hits both.
    await user.click(seats[1]);
    const popover = container.querySelector('.sc-popover');
    expect(popover).toBeTruthy();
    const setDealerBtn = Array.from(popover.querySelectorAll('button')).find((b) =>
      /set as dealer/i.test(b.textContent)
    );
    expect(setDealerBtn).toBeTruthy();
    await user.click(setDealerBtn);

    await user.click(screen.getByRole('button', { name: /^next$/i }));

    // Step 2: log actions
    expect(await screen.findByText('Log the Action')).toBeInTheDocument();
    expect(container.querySelectorAll('.sc-seat').length).toBe(4);

    // Exercise a quick action button (whichever the composer shows first).
    const composerButtons = container.querySelectorAll('.ac-buttons .ac-btn');
    expect(composerButtons.length).toBe(4);
    await user.click(composerButtons[1]); // Check/Call
    expect(container.querySelectorAll('.ar-wrapper').length).toBeGreaterThan(0);

    // Advance through the streets (no validation blocks this, matches the
    // original implementation's behavior).
    await user.click(screen.getByRole('button', { name: /next street/i }));
    await user.click(screen.getByRole('button', { name: /next street/i }));
    await user.click(screen.getByRole('button', { name: /next street/i }));

    await user.click(screen.getByRole('button', { name: /review & create hand/i }));

    // Step 3: review & save
    expect(await screen.findByText('Review & Save')).toBeInTheDocument();
    const winnerChips = container.querySelectorAll('.rv-winner-chip input[type="checkbox"]');
    expect(winnerChips.length).toBe(4);
    await user.click(winnerChips[0]);

    expect(container.querySelector('.rv-splits')).toBeTruthy();

    const saveBtn = screen.getByRole('button', { name: /create hand/i });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);
  });
});
