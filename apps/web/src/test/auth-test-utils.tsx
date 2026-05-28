import { vi } from 'vitest';
import { AuthContext, type AuthContextValue, type AuthState, type User } from '../lib/auth';

export const TEST_USER: User = {
  id: 'user-test-1',
  email: 'test@entractus.local',
  company: 'Test Co',
  displayName: 'Test User',
  timezone: 'UTC',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function makeAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const defaultState: AuthState = { status: 'unauthenticated' };
  return {
    state: defaultState,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setUser: vi.fn(),
    ...overrides,
  };
}

export function MockAuthProvider({
  value,
  children,
}: {
  value?: AuthContextValue;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={value ?? makeAuthValue()}>{children}</AuthContext.Provider>;
}
