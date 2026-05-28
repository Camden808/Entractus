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

import ForgotPasswordPage from './ForgotPasswordPage';

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/login', element: <h1>Log In</h1> },
    ],
    { initialEntries: ['/forgot-password'] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  postMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<ForgotPasswordPage />', () => {
  it('renders the form and a back-to-login link', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /forgot your password\?/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute('href', '/login');
  });

  it('requires an email', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('flags an invalid email format', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('POSTs the trimmed email and shows the success screen on 202', async () => {
    postMock.mockResolvedValueOnce({ status: 'accepted' });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/email/i), '  jane@example.com  ');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(postMock).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      { email: 'jane@example.com' },
      expect.objectContaining({ skipAuthRefresh: true }),
    );
    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();
  });

  it('shows a generic error if the request fails', async () => {
    postMock.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});
