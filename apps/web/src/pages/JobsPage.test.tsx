import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '@testing-library/react';

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

import JobsPage from './JobsPage';

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

beforeEach(() => {
  getMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<JobsPage />', () => {
  it('renders the page heading and intro on every render', () => {
    getMock.mockReturnValueOnce(new Promise(() => {}));
    render(<JobsPage />);
    expect(screen.getByRole('heading', { level: 1, name: /^job openings$/i })).toBeInTheDocument();
    expect(screen.getByText(/permanent or temporary job/i)).toBeInTheDocument();
  });

  it('shows a busy skeleton while the fetch is in flight', () => {
    getMock.mockReturnValueOnce(new Promise(() => {}));
    render(<JobsPage />);
    const skeleton = screen.getByLabelText(/loading job openings/i);
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('fetches /api/jobs on mount and renders a card per item', async () => {
    getMock.mockResolvedValueOnce({
      items: SAMPLE_JOBS,
      total: 2,
      page: 1,
      pageSize: 20,
    });
    render(<JobsPage />);

    expect(
      await screen.findByRole('heading', { level: 3, name: /senior civil engineer/i }),
    ).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(
      '/api/jobs',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    const list = screen.getByRole('list', { name: /job openings/i });
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
    getMock.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    render(<JobsPage />);

    expect(await screen.findByText(/no job openings right now/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /job openings/i })).not.toBeInTheDocument();
  });

  it('renders the error state with the message and a retry button when the request fails', async () => {
    getMock.mockRejectedValueOnce(new MockApiError(500, 'Server error', { error: 'internal' }));
    render(<JobsPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.?t load the job listings/i);
    expect(alert).toHaveTextContent(/Server error \(500\)/);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('handles a non-ApiError thrown by the client (e.g. network failure)', async () => {
    getMock.mockRejectedValueOnce(new Error('Network down'));
    render(<JobsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Network down/);
  });

  it('refetches when the Try again button is clicked', async () => {
    getMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ items: SAMPLE_JOBS, total: 2, page: 1, pageSize: 20 });
    const user = userEvent.setup();
    render(<JobsPage />);

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('list', { name: /job openings/i })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});
