import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import AdminJobsPage from './AdminJobsPage';

const { getMock, postMock, patchMock, ApiErrorMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  }
  return {
    getMock: vi.fn(),
    postMock: vi.fn(),
    patchMock: vi.fn(),
    ApiErrorMock,
  };
});

vi.mock('../lib/apiClient', () => ({
  api: { get: getMock, post: postMock, patch: patchMock },
  ApiError: ApiErrorMock,
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
    description: 'Lead structural reviews.',
  },
  {
    id: 'job-2',
    title: 'Construction Project Manager',
    state: 'TX',
    city: 'Austin',
    type: 'Temp To Perm',
    company: 'Lone Star Construction',
    postedDate: '2026-05-09T00:00:00.000Z',
    description: 'Run multifamily builds.',
  },
];

function renderPage() {
  const router = createMemoryRouter([{ path: '/admin/jobs', element: <AdminJobsPage /> }], {
    initialEntries: ['/admin/jobs'],
  });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  patchMock.mockReset();
  getMock.mockResolvedValue({
    items: SAMPLE_JOBS,
    total: SAMPLE_JOBS.length,
    page: 1,
    pageSize: 100,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<AdminJobsPage /> — list', () => {
  it('fetches /api/jobs?pageSize=100 on mount and renders one row per posting', async () => {
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });
    const items = within(screen.getByRole('list', { name: /job postings/i })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(getMock).toHaveBeenCalledWith(
      '/api/jobs?pageSize=100',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      within(items[0]!).getByRole('heading', { name: /senior civil engineer/i }),
    ).toBeInTheDocument();
    expect(within(items[0]!).getByText(/San Francisco, CA/)).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no postings', async () => {
    getMock.mockReset();
    getMock.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 100 });
    renderPage();
    expect(await screen.findByText(/no postings yet/i)).toBeInTheDocument();
  });

  it('shows a retry alert when the fetch fails', async () => {
    getMock.mockReset();
    getMock.mockRejectedValueOnce(new ApiErrorMock(500, 'server', {}));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.?t load the postings/i);
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('<AdminJobsPage /> — create', () => {
  it('POSTs /api/employer/post with the trimmed form payload and prepends the new row', async () => {
    const created = {
      id: 'job-3',
      title: 'Site Safety Coordinator',
      state: 'WA',
      city: 'Seattle',
      type: 'Temporary',
      company: 'Cascade Builders',
      postedDate: '2026-05-12T00:00:00.000Z',
      description: '6-month contract.',
    };
    postMock.mockResolvedValueOnce({ post: created });

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });

    await user.click(screen.getByRole('button', { name: /new posting/i }));

    await user.type(screen.getByLabelText(/job title/i), '  Site Safety Coordinator  ');
    await user.type(screen.getByLabelText(/^state$/i), 'WA');
    await user.type(screen.getByLabelText(/^city$/i), 'Seattle');
    await user.selectOptions(screen.getByLabelText(/^type$/i), 'Temporary');
    await user.type(screen.getByLabelText(/^company$/i), 'Cascade Builders');
    await user.type(screen.getByLabelText(/description/i), '6-month contract.');

    await user.click(screen.getByRole('button', { name: /create posting/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/employer/post', {
        title: 'Site Safety Coordinator',
        state: 'WA',
        city: 'Seattle',
        type: 'Temporary',
        company: 'Cascade Builders',
        description: '6-month contract.',
      });
    });
    expect(await screen.findByText(/created "site safety coordinator"/i)).toBeInTheDocument();

    const items = within(screen.getByRole('list', { name: /job postings/i })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(3);
    expect(
      within(items[0]!).getByRole('heading', { name: /site safety coordinator/i }),
    ).toBeInTheDocument();
  });

  it('blocks submit + flags required fields when the form is empty', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });

    await user.click(screen.getByRole('button', { name: /new posting/i }));
    await user.click(screen.getByRole('button', { name: /create posting/i }));

    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/job title/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/description/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('Cancel closes the form without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });

    await user.click(screen.getByRole('button', { name: /new posting/i }));
    expect(screen.getByRole('heading', { name: /new job posting/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('heading', { name: /new job posting/i })).not.toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe('<AdminJobsPage /> — edit', () => {
  it('PATCHes /api/employer/post/:id and updates the row in place', async () => {
    patchMock.mockResolvedValueOnce({
      post: { ...SAMPLE_JOBS[0]!, title: 'Lead Civil Engineer' },
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });

    const firstItem = within(screen.getByRole('list', { name: /job postings/i })).getAllByRole(
      'listitem',
    )[0]!;
    await user.click(within(firstItem).getByRole('button', { name: /^edit$/i }));

    const titleInput = screen.getByLabelText(/job title/i);
    expect(titleInput).toHaveValue('Senior Civil Engineer');
    await user.clear(titleInput);
    await user.type(titleInput, 'Lead Civil Engineer');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith(
        '/api/employer/post/job-1',
        expect.objectContaining({ title: 'Lead Civil Engineer' }),
      );
    });
    expect(await screen.findByText(/updated "lead civil engineer"/i)).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: /job postings/i })).getByRole('heading', {
        name: /lead civil engineer/i,
      }),
    ).toBeInTheDocument();
  });
});

describe('<AdminJobsPage /> — delete', () => {
  it('shows a confirm step, then POSTs /api/employer/delete and removes the row', async () => {
    postMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });

    const firstItem = within(screen.getByRole('list', { name: /job postings/i })).getAllByRole(
      'listitem',
    )[0]!;
    await user.click(within(firstItem).getByRole('button', { name: /^delete$/i }));
    // Pre-confirm: no API call, confirmation text is visible.
    expect(postMock).not.toHaveBeenCalled();
    expect(within(firstItem).getByText(/can.?t be undone/i)).toBeInTheDocument();

    await user.click(within(firstItem).getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/employer/delete', { id: 'job-1' });
    });
    const items = within(screen.getByRole('list', { name: /job postings/i })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(1);
    expect(
      within(items[0]!).getByRole('heading', { name: /construction project manager/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/deleted "senior civil engineer"/i)).toBeInTheDocument();
  });

  it('Cancel from the confirm step keeps the row and skips the API call', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });

    const firstItem = within(screen.getByRole('list', { name: /job postings/i })).getAllByRole(
      'listitem',
    )[0]!;
    await user.click(within(firstItem).getByRole('button', { name: /^delete$/i }));
    await user.click(within(firstItem).getByRole('button', { name: /^cancel$/i }));

    expect(postMock).not.toHaveBeenCalled();
    expect(within(firstItem).queryByText(/can.?t be undone/i)).not.toBeInTheDocument();
  });

  it('surfaces a DELETE error in the page banner', async () => {
    postMock.mockRejectedValueOnce(new ApiErrorMock(500, 'cannot_delete', {}));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: /job postings/i });

    const firstItem = within(screen.getByRole('list', { name: /job postings/i })).getAllByRole(
      'listitem',
    )[0]!;
    await user.click(within(firstItem).getByRole('button', { name: /^delete$/i }));
    await user.click(within(firstItem).getByRole('button', { name: /yes, delete/i }));

    expect(await screen.findByText(/cannot_delete/)).toBeInTheDocument();
  });
});
