import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Settings } from '../src/pages/Settings/Settings.jsx';
import { LiveSessionProvider } from '../src/context/LiveSessionContext.jsx';
import { ImportProvider } from '../src/context/ImportContext.jsx';
import { ThemeProvider } from '../src/context/ThemeContext.jsx';

// Settings renders inside Layout (Sidebar -> Link/useLocation/useLiveSession,
// plus useImport for the drop zone) and reads useTheme, exactly as in App.jsx.
function renderSettings() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LiveSessionProvider>
          <ImportProvider>
            <Settings />
          </ImportProvider>
        </LiveSessionProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const USER = {
  name: 'Test User',
  email: 'test@example.com',
  isAccountVerified: true,
  preferences: { theme: 'dark', accent: 'orange' },
};

// Captures every PATCH so a test can assert on what was actually sent.
let patches;

function mockFetch({ prefsOk = true } = {}) {
  patches = [];
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const u = String(url);
    const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

    if (u.includes('/api/user/preferences')) {
      const body = JSON.parse(opts.body);
      patches.push(body);
      return prefsOk
        ? json({ success: true, preferences: { ...USER.preferences, ...body } })
        : json({ success: false, message: 'Invalid preferences' });
    }
    if (u.includes('/api/user/data')) return json({ success: true, userData: USER });
    if (u.includes('/api/user/storage')) {
      return json({ success: true, storage: { bytesUsed: 1024, bytesLimit: 2048, handsUsed: 5, handsLimit: 10, sessionCount: 2 } });
    }
    if (u.includes('/api/live-sessions')) return json([]);
    return json([]);
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-accent');
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

describe('Settings: account', () => {
  it('shows which account is signed in', async () => {
    mockFetch();
    renderSettings();
    // The email is why getUserData started returning it - without this the
    // app never told you which account you were looking at.
    expect(await screen.findByText('test@example.com')).toBeInTheDocument();
  });

  it('keeps Save disabled until the name actually changes', async () => {
    mockFetch();
    renderSettings();
    const field = await screen.findByLabelText('Display name');
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();
    await userEvent.type(field, '!');
    expect(save).toBeEnabled();
  });
});

describe('Settings: delete account confirmation', () => {
  it('stays disabled until the email matches and a password is given', async () => {
    mockFetch();
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const confirm = screen.getByRole('button', { name: /Permanently delete/i });
    expect(confirm).toBeDisabled();

    // Exact match: the Security section above has "Current password",
    // "New password ..." and "Confirm new password" too.
    const delPassword = screen.getByLabelText('Password');
    // Right password, wrong email - still refused.
    await userEvent.type(delPassword, 'some-password');
    await userEvent.type(screen.getByLabelText(/to confirm/i), 'wrong@example.com');
    expect(confirm).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/to confirm/i));
    await userEvent.type(screen.getByLabelText(/to confirm/i), 'test@example.com');
    expect(confirm).toBeEnabled();
  });
});

describe('Settings: appearance', () => {
  it('applies a chosen accent to the document and persists it', async () => {
    mockFetch();
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: 'Teal' }));

    await waitFor(() => expect(document.documentElement.dataset.accent).toBe('teal'));
    expect(patches).toEqual([{ accent: 'teal' }]);
  });

  it('reverts the swatch when the server refuses the write', async () => {
    // Optimistic updates are what make a swatch click feel instant; the cost
    // is that a rejected write must not leave the UI claiming a preference
    // the server never stored.
    mockFetch({ prefsOk: false });
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: 'Violet' }));

    await waitFor(() => expect(document.documentElement.dataset.accent).toBe('orange'));
    expect(await screen.findByText('Invalid preferences')).toBeInTheDocument();
  });

  it('marks exactly one swatch as pressed', async () => {
    mockFetch();
    renderSettings();
    await screen.findByRole('button', { name: 'Teal' });

    const pressed = screen.getAllByRole('button', { pressed: true });
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Orange');
  });
});
