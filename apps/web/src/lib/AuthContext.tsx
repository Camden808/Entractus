import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, setAccessToken } from './apiClient';
import {
  AuthContext,
  type AuthContextValue,
  type AuthSession,
  type AuthState,
  type RegisterPayload,
  type User,
} from './auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // Bootstrap: try to silently refresh and rehydrate the user from the
  // httpOnly cookie. Any failure (no cookie, expired, network) means we
  // simply land in 'unauthenticated' — no error surfaced.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const refreshed = await api.post<{ accessToken?: string }>('/api/auth/refresh', undefined, {
          signal: controller.signal,
          skipAuthRefresh: true,
        });
        if (controller.signal.aborted) return;
        if (!refreshed.accessToken) {
          setState({ status: 'unauthenticated' });
          return;
        }
        setAccessToken(refreshed.accessToken);
        const me = await api.get<{ user: User }>('/api/users/me', {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setState({ status: 'authenticated', user: me.user });
      } catch {
        if (controller.signal.aborted) return;
        setAccessToken(null);
        setState({ status: 'unauthenticated' });
      }
    })();
    return () => controller.abort();
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post<AuthSession>(
      '/api/auth/login',
      { email, password },
      { skipAuthRefresh: true },
    );
    setAccessToken(res.accessToken);
    setState({ status: 'authenticated', user: res.user });
    return res.user;
  }

  async function register(payload: RegisterPayload): Promise<User> {
    const res = await api.post<AuthSession>('/api/auth/register', payload, {
      skipAuthRefresh: true,
    });
    setAccessToken(res.accessToken);
    setState({ status: 'authenticated', user: res.user });
    return res.user;
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      // Logout is best-effort. A network/server failure shouldn't trap
      // the user in a "still logged in" UI — clear local state anyway.
      if (!(err instanceof ApiError)) {
        // swallow unexpected errors; we still want to clear local state
      }
    }
    setAccessToken(null);
    setState({ status: 'unauthenticated' });
  }

  async function refreshUser(): Promise<User | null> {
    try {
      const me = await api.get<{ user: User }>('/api/users/me');
      setState({ status: 'authenticated', user: me.user });
      return me.user;
    } catch {
      setAccessToken(null);
      setState({ status: 'unauthenticated' });
      return null;
    }
  }

  function setUser(user: User) {
    setState({ status: 'authenticated', user });
  }

  const value: AuthContextValue = {
    state,
    login,
    register,
    logout,
    refreshUser,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
