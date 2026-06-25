import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import AccountPage from './AccountPage';
import LoginPage from './LoginPage';
import HomePage from './HomePage';
import { MockAuthProvider, makeAuthValue, TEST_USER } from '../test/auth-test-utils';
import type { AuthContextValue } from '../lib/auth';

const { patchMock, postMock, deleteMock, ApiErrorMock } = vi.hoisted(() => {
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
    patchMock: vi.fn(),
    postMock: vi.fn(),
    deleteMock: vi.fn(),
    ApiErrorMock,
  };
});

vi.mock('../lib/apiClient', () => ({
  api: { patch: patchMock, post: postMock, delete: deleteMock, get: vi.fn() },
  ApiError: ApiErrorMock,
  setAccessToken: vi.fn(),
}));

function renderAccount(authValue?: AuthContextValue) {
  const router = createMemoryRouter(
    [
      { path: '/account', element: <AccountPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <HomePage /> },
    ],
    { initialEntries: ['/account'] },
  );
  return render(
    <MockAuthProvider value={authValue}>
      <RouterProvider router={router} />
    </MockAuthProvider>,
  );
}

beforeEach(() => {
  patchMock.mockReset();
  postMock.mockReset();
  deleteMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<AccountPage /> — gating', () => {
  it('shows a loading message while auth state is bootstrapping', () => {
    renderAccount(makeAuthValue({ state: { status: 'loading' } }));
    expect(screen.getByRole('heading', { level: 1, name: /^your account$/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/loading your account/i);
  });

  it('redirects to /login when unauthenticated', async () => {
    renderAccount(makeAuthValue({ state: { status: 'unauthenticated' } }));
    expect(await screen.findByRole('heading', { level: 1, name: /^log in$/i })).toBeInTheDocument();
  });
});

describe('<AccountPage /> — profile read', () => {
  it('renders email, displayName, timezone, company, role, and created date', () => {
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));
    const profile = screen.getByRole('region', { name: /^profile$/i });
    expect(within(profile).getByText(TEST_USER.email)).toBeInTheDocument();
    expect(within(profile).getByText('Test User')).toBeInTheDocument();
    expect(within(profile).getByText('UTC')).toBeInTheDocument();
    expect(within(profile).getByText('Test Co')).toBeInTheDocument();
    expect(within(profile).getByText('user')).toBeInTheDocument();
  });
});

describe('<AccountPage /> — profile edit', () => {
  it('disables Save while the form is pristine, then PATCHes only changed fields', async () => {
    const setUser = vi.fn();
    patchMock.mockResolvedValueOnce({ user: { ...TEST_USER, displayName: 'New Name' } });

    const user = userEvent.setup();
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER }, setUser }));

    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();

    const displayInput = screen.getByLabelText(/display name/i);
    await user.clear(displayInput);
    await user.type(displayInput, 'New Name');

    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith('/api/users/me', { displayName: 'New Name' });
    });
    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'New Name' }));
    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
  });

  it('surfaces a PATCH error in a banner', async () => {
    patchMock.mockRejectedValueOnce(new ApiErrorMock(500, 'server_error', {}));
    const user = userEvent.setup();
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));

    await user.type(screen.getByLabelText(/display name/i), '!');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/server_error/)).toBeInTheDocument();
  });
});

describe('<AccountPage /> — change password', () => {
  it('POSTs forgot-password with the user email and shows a success banner', async () => {
    postMock.mockResolvedValueOnce({ status: 'accepted' });
    const user = userEvent.setup();
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));

    await user.click(screen.getByRole('button', { name: /send password-reset email/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith('/api/auth/forgot-password', {
        email: TEST_USER.email,
      });
    });
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });

  it('shows an error banner if the request fails', async () => {
    postMock.mockRejectedValueOnce(new ApiErrorMock(500, 'mail_down', {}));
    const user = userEvent.setup();
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));

    await user.click(screen.getByRole('button', { name: /send password-reset email/i }));
    expect(await screen.findByText(/mail_down/)).toBeInTheDocument();
  });
});

describe('<AccountPage /> — delete account', () => {
  it('shows a destructive confirm step, then DELETEs + logs out + navigates home', async () => {
    deleteMock.mockResolvedValueOnce(undefined);
    const logout = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER }, logout }));

    // First click is the destructive trigger, not the actual delete.
    await user.click(screen.getByRole('button', { name: /^delete my account$/i }));
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText(/are you sure\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /yes, delete my account/i }));

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('/api/users/me');
    });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('heading', { level: 1, name: /building careers/i }),
    ).toBeInTheDocument();
  });

  it('Cancel from the confirm step returns to the safe state without calling DELETE', async () => {
    const user = userEvent.setup();
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));

    await user.click(screen.getByRole('button', { name: /^delete my account$/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/are you sure\?/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete my account$/i })).toBeInTheDocument();
  });

  it('surfaces a DELETE error inline', async () => {
    deleteMock.mockRejectedValueOnce(new ApiErrorMock(500, 'cannot_delete', {}));
    const user = userEvent.setup();
    renderAccount(makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));

    await user.click(screen.getByRole('button', { name: /^delete my account$/i }));
    await user.click(screen.getByRole('button', { name: /yes, delete my account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot_delete/);
  });
});
