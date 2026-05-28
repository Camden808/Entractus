import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import LoginPage from './LoginPage';
import AccountPage from './AccountPage';
import { MockAuthProvider, makeAuthValue, TEST_USER } from '../test/auth-test-utils';
import type { AuthContextValue } from '../lib/auth';

const { ApiErrorMock } = vi.hoisted(() => {
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
  return { ApiErrorMock };
});

vi.mock('../lib/apiClient', () => ({
  api: { post: vi.fn(), get: vi.fn() },
  ApiError: ApiErrorMock,
  setAccessToken: vi.fn(),
}));

function renderLogin(authValue?: AuthContextValue, initialPath = '/login') {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/account', element: <AccountPage /> },
    ],
    { initialEntries: [initialPath] },
  );
  return render(
    <MockAuthProvider value={authValue}>
      <RouterProvider router={router} />
    </MockAuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<LoginPage />', () => {
  it('renders the heading, email/password inputs, and links to register + forgot-password', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1, name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('blocks submission and surfaces required errors when fields are empty', async () => {
    const login = vi.fn();
    const user = userEvent.setup();
    renderLogin(makeAuthValue({ login }));
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('flags an invalid email format', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'somepassword');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });

  it('calls login() with trimmed email + password on submit and redirects to /account', async () => {
    const login = vi.fn().mockResolvedValue(TEST_USER);
    const user = userEvent.setup();
    renderLogin(makeAuthValue({ login }));
    await user.type(screen.getByLabelText(/email/i), '  jane@example.com  ');
    await user.type(screen.getByLabelText(/password/i), 'correct horse');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(login).toHaveBeenCalledWith('jane@example.com', 'correct horse');
    expect(
      await screen.findByRole('heading', { level: 1, name: /^your account$/i }),
    ).toBeInTheDocument();
  });

  it('shows a generic "no match" error on 401 invalid_credentials', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        new ApiErrorMock(401, 'invalid_credentials', { error: 'invalid_credentials' }),
      );
    const user = userEvent.setup();
    renderLogin(makeAuthValue({ login }));
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/don.?t match an account/i);
  });

  it('shows a generic fallback error for non-ApiError throws', async () => {
    const login = vi.fn().mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderLogin(makeAuthValue({ login }));
    await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/password/i), 'pw');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });

  it('immediately redirects to /account if the user is already authenticated', async () => {
    renderLogin(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^your account$/i }),
    ).toBeInTheDocument();
  });
});
