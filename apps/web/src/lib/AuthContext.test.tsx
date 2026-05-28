import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const { postMock, getMock, setAccessTokenMock, ApiErrorMock } = vi.hoisted(() => {
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
    postMock: vi.fn(),
    getMock: vi.fn(),
    setAccessTokenMock: vi.fn(),
    ApiErrorMock,
  };
});

vi.mock('./apiClient', () => ({
  api: { post: postMock, get: getMock },
  ApiError: ApiErrorMock,
  setAccessToken: setAccessTokenMock,
}));

import { AuthProvider } from './AuthContext';
import { useAuth, type User } from './auth';

const TEST_USER: User = {
  id: 'u1',
  email: 'jane@example.com',
  company: null,
  displayName: 'Jane',
  timezone: 'UTC',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function Probe() {
  const { state } = useAuth();
  if (state.status === 'loading') return <p>state:loading</p>;
  if (state.status === 'unauthenticated') return <p>state:unauthenticated</p>;
  return <p>state:authenticated user:{state.user.email}</p>;
}

function ActionProbe() {
  const { state, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      <button onClick={() => void login('jane@example.com', 'pw')}>do-login</button>
      <button onClick={() => void logout()}>do-logout</button>
    </div>
  );
}

beforeEach(() => {
  postMock.mockReset();
  getMock.mockReset();
  setAccessTokenMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('<AuthProvider />', () => {
  it('lands in unauthenticated when the initial refresh call fails', async () => {
    postMock.mockRejectedValueOnce(new ApiErrorMock(401, 'no_refresh_token', {}));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText(/state:unauthenticated/i)).toBeInTheDocument();
  });

  it('lands in unauthenticated when refresh returns no accessToken', async () => {
    postMock.mockResolvedValueOnce({});
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText(/state:unauthenticated/i)).toBeInTheDocument();
  });

  it('bootstraps: refresh ok → fetches /api/users/me → state authenticated', async () => {
    postMock.mockResolvedValueOnce({ accessToken: 'fresh-token' });
    getMock.mockResolvedValueOnce({ user: TEST_USER });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(
      await screen.findByText(/state:authenticated user:jane@example.com/i),
    ).toBeInTheDocument();
    expect(setAccessTokenMock).toHaveBeenCalledWith('fresh-token');
  });

  it('login() sets the token + transitions to authenticated', async () => {
    postMock.mockRejectedValueOnce(new ApiErrorMock(401, 'no', {})); // bootstrap refresh fails
    postMock.mockResolvedValueOnce({ user: TEST_USER, accessToken: 'login-token' }); // login

    render(
      <AuthProvider>
        <ActionProbe />
      </AuthProvider>,
    );
    await screen.findByText('unauthenticated');

    await act(async () => {
      screen.getByText('do-login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });
    expect(setAccessTokenMock).toHaveBeenLastCalledWith('login-token');
  });

  it('logout() clears the token + transitions to unauthenticated', async () => {
    postMock.mockResolvedValueOnce({ accessToken: 'bootstrap' }); // bootstrap refresh ok
    getMock.mockResolvedValueOnce({ user: TEST_USER }); // /me
    postMock.mockResolvedValueOnce(undefined); // logout

    render(
      <AuthProvider>
        <ActionProbe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });

    await act(async () => {
      screen.getByText('do-logout').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
    expect(setAccessTokenMock).toHaveBeenLastCalledWith(null);
  });

  it('clears local state even if the logout request fails', async () => {
    postMock.mockResolvedValueOnce({ accessToken: 'bootstrap' });
    getMock.mockResolvedValueOnce({ user: TEST_USER });
    postMock.mockRejectedValueOnce(new Error('network down'));

    render(
      <AuthProvider>
        <ActionProbe />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });

    await act(async () => {
      screen.getByText('do-logout').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
  });
});
