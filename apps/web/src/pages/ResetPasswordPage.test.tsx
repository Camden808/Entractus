import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

const { postMock, ApiErrorMock } = vi.hoisted(() => {
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
  return { postMock: vi.fn(), ApiErrorMock };
});

vi.mock('../lib/apiClient', () => ({
  api: { post: postMock },
  ApiError: ApiErrorMock,
}));

import ResetPasswordPage from './ResetPasswordPage';

function renderPageAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/login', element: <h1>Log In</h1> },
      { path: '/forgot-password', element: <h1>Forgot</h1> },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  postMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<ResetPasswordPage />', () => {
  it('shows a missing-token error when ?token= is absent', () => {
    renderPageAt('/reset-password');
    expect(screen.getByRole('heading', { name: /missing or invalid/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get a new link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it('renders the form when a token is present', () => {
    renderPageAt('/reset-password?token=abc123');
    expect(
      screen.getByRole('heading', { level: 1, name: /^reset your password$/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it('requires a password ≥8 chars and matching confirmation', async () => {
    const user = userEvent.setup();
    renderPageAt('/reset-password?token=t');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^new password$/i)).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText(/^new password$/i), 'longenough1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'mismatch');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/confirm new password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('POSTs token + password and shows a success screen', async () => {
    postMock.mockResolvedValueOnce({ status: 'ok' });
    const user = userEvent.setup();
    renderPageAt('/reset-password?token=abc123');
    await user.type(screen.getByLabelText(/^new password$/i), 'longenough1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'longenough1');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(postMock).toHaveBeenCalledWith(
      '/api/auth/reset-password',
      { token: 'abc123', password: 'longenough1' },
      expect.objectContaining({ skipAuthRefresh: true }),
    );
    expect(await screen.findByRole('heading', { name: /password updated/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to log in/i })).toHaveAttribute('href', '/login');
  });

  it('surfaces a 400 invalid_or_expired_token error inline', async () => {
    postMock.mockRejectedValueOnce(
      new ApiErrorMock(400, 'invalid_or_expired_token', { error: 'invalid_or_expired_token' }),
    );
    const user = userEvent.setup();
    renderPageAt('/reset-password?token=stale');
    await user.type(screen.getByLabelText(/^new password$/i), 'longenough1');
    await user.type(screen.getByLabelText(/confirm new password/i), 'longenough1');
    await user.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer valid/i);
  });
});
