import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// An import runs on the server, not in the tab that started it (see
// importRunner.js), so its progress has to keep reporting itself no matter
// what the user does in the browser meanwhile - change page, or reload.
// That's what ImportContext + ImportStatus exist for, and it's what these
// cover: the state lives above <Routes>, and a fresh load re-adopts the
// job the server says is still running.

const RUNNING_JOB = {
  jobId: 'job-1',
  status: 'running',
  totalFiles: 12,
  progress: { filesDone: 3, handsImported: 900, handsSkipped: 0, stage: 'importing', personsDone: 0, personsTotal: 0 },
};

// `statuses` is consumed one entry per poll; the last one repeats, so a
// test that never wants the job to finish just passes a single 'running'.
function mockFetch({ activeJob = null, statuses = [] } = {}) {
  const queue = [...statuses];
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

    if (u.includes('/api/user/data')) return json({ success: true, userData: { name: 'Test User' } });
    if (u.includes('/api/imports/active')) return json({ job: activeJob });
    if (u.includes('/api/imports/')) return json(queue.length > 1 ? queue.shift() : queue[0]);
    // Sidebar polling, session lists, stats - an empty result none of them
    // error out on.
    return json([]);
  });
}

function renderApp(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

describe('import progress', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a still-running import after a reload, on a page with no import UI of its own', async () => {
    mockFetch({
      activeJob: RUNNING_JOB,
      statuses: [{ ...RUNNING_JOB, files: [] }],
    });

    // /login has no Layout, no "Import hands" CTA and no drop zone - if the
    // card shows here, it isn't coming from any page's own import state.
    renderApp('/login');

    expect(await screen.findByText(/Importing 3 of 12 file/)).toBeInTheDocument();
  });

  it('keeps the progress card up across a page navigation', async () => {
    mockFetch({
      activeJob: RUNNING_JOB,
      statuses: [{ ...RUNNING_JOB, files: [] }],
    });
    const user = userEvent.setup();
    renderApp('/history');

    await screen.findByText(/Importing 3 of 12 file/);

    // A real navigation, which unmounts History and its Layout entirely -
    // where this state used to live.
    await user.click(screen.getByRole('link', { name: 'Players' }));
    await screen.findByRole('heading', { name: 'Players' });

    expect(screen.getByText(/Importing 3 of 12 file/)).toBeInTheDocument();
  });

  it('clears the card once the job finishes', async () => {
    mockFetch({
      activeJob: RUNNING_JOB,
      statuses: [
        {
          ...RUNNING_JOB,
          status: 'done',
          progress: { ...RUNNING_JOB.progress, filesDone: 12, handsImported: 4200 },
          files: [],
        },
      ],
    });

    renderApp('/login');

    await waitFor(() => {
      expect(screen.queryByText(/Importing/)).not.toBeInTheDocument();
    });
  });

  it('asks the server for a running job exactly once per load', async () => {
    mockFetch({ activeJob: null });
    renderApp('/login');

    await waitFor(() => {
      const activeCalls = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/api/imports/active'));
      expect(activeCalls).toHaveLength(1);
    });
    expect(screen.queryByText(/Importing/)).not.toBeInTheDocument();
  });
});
