import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import JobsPage from './JobsPage';

const { getMock, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  }
  return { getMock: vi.fn(), MockApiError };
});

vi.mock('../lib/apiClient', () => ({
  api: { get: getMock },
  ApiError: MockApiError,
}));

const SAMPLE_JOBS = [
  {
    id: 'job-1',
    title: 'Senior Civil Engineer',
    state: 'CA',
    city: 'San Francisco',
    type: 'Direct Hire',
    company: 'Bay Bridge Builders',
    postedDate: '2026-05-10T00:00:00.000Z',
    description: 'desc 1',
  },
  {
    id: 'job-2',
    title: 'Construction Project Manager',
    state: 'TX',
    city: 'Austin',
    type: 'Temp To Perm',
    company: 'Lone Star Construction',
    postedDate: '2026-05-09T00:00:00.000Z',
    description: 'desc 2',
  },
];

function makeJobsResponse(items: typeof SAMPLE_JOBS, pageSize = 20) {
  return { items, total: items.length, page: 1, pageSize };
}

// URL-aware default mock: the facets snapshot (?pageSize=100) and the results
// query are answered independently so the test doesn't depend on React's
// effect-firing order.
function installDefaultMock({
  facets = SAMPLE_JOBS,
  results = SAMPLE_JOBS,
}: {
  facets?: typeof SAMPLE_JOBS;
  results?: typeof SAMPLE_JOBS;
} = {}) {
  getMock.mockImplementation((url: string) => {
    if (url.includes('pageSize=100')) return Promise.resolve(makeJobsResponse(facets, 100));
    return Promise.resolve(makeJobsResponse(results));
  });
}

function renderAt(initialEntry: string = '/jobs') {
  const router = createMemoryRouter([{ path: '/jobs', element: <JobsPage /> }], {
    initialEntries: [initialEntry],
  });
  return { ...render(<RouterProvider router={router} />), router };
}

function resultsCalls(): unknown[][] {
  return getMock.mock.calls.filter((args) => {
    const url = args[0];
    return typeof url === 'string' && !url.includes('pageSize=100');
  });
}

function facetsCalls(): unknown[][] {
  return getMock.mock.calls.filter((args) => {
    const url = args[0];
    return typeof url === 'string' && url.includes('pageSize=100');
  });
}

beforeEach(() => {
  getMock.mockReset();
  installDefaultMock();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<JobsPage /> — gallery (Task 8.1)', () => {
  it('renders the page heading and intro on every render', async () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: /^job openings$/i })).toBeInTheDocument();
    expect(screen.getByText(/permanent or temporary job/i)).toBeInTheDocument();
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });
  });

  it('shows a busy skeleton while the fetch is in flight', () => {
    getMock.mockReset();
    getMock.mockReturnValue(new Promise(() => {}));
    renderAt();
    const skeleton = screen.getByLabelText(/loading job openings/i);
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('fetches /api/jobs on mount and renders a card per item', async () => {
    renderAt();

    expect(
      await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i }),
    ).toBeInTheDocument();

    const list = screen.getByRole('list', { name: /^job openings$/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const first = within(items[0]!);
    expect(first.getByText(/San Francisco, CA/)).toBeInTheDocument();
    expect(first.getByText(/Bay Bridge Builders/)).toBeInTheDocument();
    expect(first.getByText(/Direct Hire/)).toBeInTheDocument();
    const time = items[0]!.querySelector('time');
    expect(time).not.toBeNull();
    expect(time!.getAttribute('datetime')).toBe('2026-05-10T00:00:00.000Z');
  });

  it('shows the empty state when /api/jobs returns no items', async () => {
    installDefaultMock({ facets: [], results: [] });
    renderAt();

    expect(await screen.findByText(/no job openings right now/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^job openings$/i })).not.toBeInTheDocument();
  });

  it('renders the error state with the message and a retry button when the request fails', async () => {
    getMock.mockReset();
    getMock.mockImplementation((url: string) => {
      if (url.includes('pageSize=100')) return Promise.resolve(makeJobsResponse(SAMPLE_JOBS, 100));
      return Promise.reject(new MockApiError(500, 'Server error', { error: 'internal' }));
    });
    renderAt();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.?t load the job listings/i);
    expect(alert).toHaveTextContent(/Server error \(500\)/);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('handles a non-ApiError thrown by the client (e.g. network failure)', async () => {
    getMock.mockReset();
    getMock.mockImplementation((url: string) => {
      if (url.includes('pageSize=100')) return Promise.resolve(makeJobsResponse(SAMPLE_JOBS, 100));
      return Promise.reject(new Error('Network down'));
    });
    renderAt();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Network down/);
  });

  it('refetches when the Try again button is clicked', async () => {
    let resultsCall = 0;
    getMock.mockImplementation((url: string) => {
      if (url.includes('pageSize=100')) return Promise.resolve(makeJobsResponse(SAMPLE_JOBS, 100));
      resultsCall += 1;
      if (resultsCall === 1) return Promise.reject(new Error('boom'));
      return Promise.resolve(makeJobsResponse(SAMPLE_JOBS));
    });
    const user = userEvent.setup();
    renderAt();

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('list', { name: /^job openings$/i })).toBeInTheDocument();
  });
});

describe('<JobsPage /> — search & filters (Task 8.2)', () => {
  it('hydrates search input + filter dropdowns from URL params on mount', async () => {
    renderAt(
      '/jobs?q=engineer&state=CA&city=San%20Francisco&type=Direct%20Hire&company=Bay%20Bridge%20Builders',
    );

    expect(screen.getByRole('searchbox', { name: /search by job title/i })).toHaveValue('engineer');
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });

    expect(screen.getByRole('combobox', { name: /^state$/i })).toHaveValue('CA');
    expect(screen.getByRole('combobox', { name: /^city$/i })).toHaveValue('San Francisco');
    expect(screen.getByRole('combobox', { name: /^type$/i })).toHaveValue('Direct Hire');
    expect(screen.getByRole('combobox', { name: /^company$/i })).toHaveValue('Bay Bridge Builders');
  });

  it('forwards the URL filters into the GET /api/jobs query string (omitting empties)', async () => {
    renderAt('/jobs?q=engineer&state=CA');
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });

    const last = resultsCalls().at(-1)![0] as string;
    expect(last).toContain('q=engineer');
    expect(last).toContain('state=CA');
    expect(last).not.toContain('city=');
    expect(last).not.toContain('type=');
    expect(last).not.toContain('company=');
  });

  it('debounces typing in the search box before pushing to the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/jobs');
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });

    await user.type(screen.getByRole('searchbox', { name: /search by job title/i }), 'eng');

    // After typing, the debounce delay (300ms) is still pending. The URL
    // sync may not have happened by the next microtask — wait for it.
    await waitFor(
      () => {
        expect(router.state.location.search).toBe('?q=eng');
      },
      { timeout: 1500 },
    );
  });

  it('selecting a filter dropdown immediately pushes the value to the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/jobs');
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });

    await user.selectOptions(screen.getByRole('combobox', { name: /^state$/i }), 'CA');

    await waitFor(() => {
      expect(router.state.location.search).toContain('state=CA');
    });
  });

  it('Clear filters wipes search + dropdowns and removes all URL params', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/jobs?q=engineer&state=CA&type=Direct%20Hire');
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(screen.getByRole('searchbox', { name: /search by job title/i })).toHaveValue('');
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('issues a separate /api/jobs?pageSize=100 snapshot to populate the state/city/company dropdowns', async () => {
    renderAt('/jobs');
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });

    expect(facetsCalls().length).toBe(1);

    // Both SAMPLE_JOBS states appear as options (in addition to "All states").
    const state = screen.getByRole('combobox', { name: /^state$/i });
    expect(within(state).getByRole('option', { name: 'CA' })).toBeInTheDocument();
    expect(within(state).getByRole('option', { name: 'TX' })).toBeInTheDocument();
  });

  it('shows a filter-aware empty message when results are zero but filters are active', async () => {
    installDefaultMock({ facets: SAMPLE_JOBS, results: [] });
    renderAt('/jobs?q=nothingMatches');

    expect(await screen.findByText(/no openings match the current filters/i)).toBeInTheDocument();
  });

  it('exposes Temporary / Temp To Perm / Direct Hire / Full Time / Part Time as the Type options', async () => {
    renderAt('/jobs');
    await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i });
    const type = screen.getByRole('combobox', { name: /^type$/i });
    for (const t of ['Temporary', 'Temp To Perm', 'Direct Hire', 'Full Time', 'Part Time']) {
      expect(within(type).getByRole('option', { name: t })).toBeInTheDocument();
    }
  });
});
