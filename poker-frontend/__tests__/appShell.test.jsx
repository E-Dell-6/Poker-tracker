import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../src/components/Layout.jsx';
import { ThemeProvider } from '../src/context/ThemeContext.jsx';
import { LiveSessionProvider } from '../src/context/LiveSessionContext.jsx';
import { ImportProvider } from '../src/context/ImportContext.jsx';

function mockFetch() {
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (u.includes('/api/user/data')) {
      return json({ success: true, userData: { name: 'Test User', isAccountVerified: true } });
    }
    if (u.includes('/api/imports/active')) return json({ job: null });
    if (u.includes('/api/live-sessions/active')) return json(null);
    return json([]);
  });
}

function renderShell(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/players']}>
      <ThemeProvider>
        <LiveSessionProvider>
          <ImportProvider>
            <Layout title="Players" {...props}>
              <p>Page body</p>
            </Layout>
          </ImportProvider>
        </LiveSessionProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

const sidebar = () => document.querySelector('.sidebar');

beforeEach(() => {
  localStorage.clear();
  mockFetch();
});

describe('Sidebar', () => {
  it('remembers being collapsed, and its links keep their names', async () => {
    const user = userEvent.setup();
    const { unmount } = renderShell();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(sidebar()).toHaveClass('collapsed');
    unmount();

    renderShell();
    expect(sidebar()).toHaveClass('collapsed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('navigation drawer', () => {
  it('opens from the header menu button and closes on Escape, returning focus', async () => {
    const user = userEvent.setup();
    renderShell();
    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(menuButton);
    expect(sidebar()).toHaveClass('is-mobile-open');
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(sidebar()).not.toHaveClass('is-mobile-open');
    expect(menuButton).toHaveFocus();
  });

  it('closes when the scrim is tapped', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(document.querySelector('.sidebar-scrim'));
    expect(sidebar()).not.toHaveClass('is-mobile-open');
    expect(document.querySelector('.sidebar-scrim')).not.toBeInTheDocument();
  });
});

describe('TopHeader', () => {
  it('opens the CTA menu and runs the chosen item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderShell({
      ctaLabel: 'Import hands',
      ctaMenu: [{ label: 'Upload files', description: 'CSV or text', onSelect }],
    });
    await user.click(screen.getByRole('button', { name: 'Import hands' }));
    await user.click(screen.getByRole('menuitem', { name: /Upload files/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('focuses the search box on "/"', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.keyboard('/');
    expect(screen.getByRole('textbox', { name: 'Search hands or players' })).toHaveFocus();
  });
});

describe('account menu', () => {
  it('closes on Escape and returns focus to the avatar button', async () => {
    const user = userEvent.setup();
    renderShell();
    const account = await screen.findByRole('button', { name: /Test User/ });
    await user.click(account);
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(account).toHaveFocus();
  });
});
