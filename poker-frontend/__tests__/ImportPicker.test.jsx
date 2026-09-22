import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// The "Import hands" file picker's accept= list, which is the whole of
// whether a phone will let you pick your hand history at all.
//
// A mobile picker matches accept= against the MIME type its file provider
// reports, and a PokerNow .csv is reported as anything from
// text/comma-separated-values to application/octet-stream - so an
// extension-only list greys out the one file the user came to upload, with
// no drag-and-drop to fall back to. See History.jsx.

function mockFetch() {
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (u.includes('/api/user/data')) return json({ success: true, userData: { name: 'Test User' } });
    if (u.includes('/api/imports/active')) return json({ job: null });
    if (u.includes('/api/sessions')) return json({ sessions: [], total: 0, summary: null });
    return json([]);
  });
}

// jsdom's matchMedia reports every query as not matching, so a test that
// wants the mobile branch has to say so.
function mockPointer(kind) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('pointer: coarse') ? kind === 'coarse' : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

// The file picker, as opposed to the folder picker beside it - which has
// never carried an accept= and isn't what this is about.
async function filePickerInput(container) {
  return waitFor(() => {
    const input = [...container.querySelectorAll('input[type="file"]')]
      .find((el) => !el.hasAttribute('webkitdirectory'));
    expect(input).toBeTruthy();
    return input;
  });
}

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <App />
    </MemoryRouter>
  );
}

describe('import file picker', () => {
  const realMatchMedia = window.matchMedia;

  afterEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = realMatchMedia;
  });

  it('names MIME types as well as extensions, for pickers that filter on type', async () => {
    mockFetch();
    mockPointer('fine');
    const { container } = renderHistory();

    const accept = (await filePickerInput(container)).getAttribute('accept');
    expect(accept).toContain('.csv');
    expect(accept).toContain('.txt');
    expect(accept).toContain('text/csv');
    expect(accept).toContain('text/plain');
  });

  it('drops accept= entirely on a touch device, where a greyed-out file has no workaround', async () => {
    mockFetch();
    mockPointer('coarse');
    const { container } = renderHistory();

    expect((await filePickerInput(container)).hasAttribute('accept')).toBe(false);
  });
});
