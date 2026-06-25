import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import RegisterPage from './RegisterPage';
import { MockAuthProvider, makeAuthValue, TEST_USER } from '../test/auth-test-utils';

// Stub destination so we don't have to wire AccountPage's auth gating into
// these RegisterPage tests. We're verifying navigation, not the portal.
function AccountStub() {
  return <h1>Your Account</h1>;
}
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

function renderRegister(authValue?: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { path: '/register', element: <RegisterPage /> },
      { path: '/account', element: <AccountStub /> },
    ],
    { initialEntries: ['/register'] },
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

describe('<RegisterPage />', () => {
  it('renders all expected fields + a link back to login', () => {
    renderRegister();
    expect(
      screen.getByRole('heading', { level: 1, name: /^create an account$/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('requires a password of at least 8 characters', async () => {
    const register = vi.fn();
    const user = userEvent.setup();
    renderRegister(makeAuthValue({ register }));
    await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'short');
    await user.type(screen.getByLabelText(/confirm password/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(register).not.toHaveBeenCalled();
    const pw = screen.getByLabelText(/^password$/i);
    expect(pw).toHaveAttribute('aria-invalid', 'true');
  });

  it('flags mismatched password confirmation', async () => {
    const register = vi.fn();
    const user = userEvent.setup();
    renderRegister(makeAuthValue({ register }));
    await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'longenough1');
    await user.type(screen.getByLabelText(/confirm password/i), 'different');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(register).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('calls register() with optional fields omitted when blank, then redirects to /account', async () => {
    const register = vi.fn().mockResolvedValue(TEST_USER);
    const user = userEvent.setup();
    renderRegister(makeAuthValue({ register }));
    await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'longenough1');
    await user.type(screen.getByLabelText(/confirm password/i), 'longenough1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(register).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'longenough1',
      displayName: undefined,
      company: undefined,
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: /^your account$/i }),
    ).toBeInTheDocument();
  });

  it('surfaces a 409 conflict as an inline email error', async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new ApiErrorMock(409, 'email_taken', { error: 'email_taken' }));
    const user = userEvent.setup();
    renderRegister(makeAuthValue({ register }));
    await user.type(screen.getByLabelText(/^email$/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'longenough1');
    await user.type(screen.getByLabelText(/confirm password/i), 'longenough1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('redirects to /account if already authenticated', async () => {
    renderRegister(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /^your account$/i }),
    ).toBeInTheDocument();
  });
});
