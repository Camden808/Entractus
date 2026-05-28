import { createContext, useContext } from 'react';

export type User = {
  id: string;
  email: string;
  company: string | null;
  displayName: string | null;
  timezone: string;
  role: 'user' | 'admin';
  createdAt: string;
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' };

export type RegisterPayload = {
  email: string;
  password: string;
  company?: string;
  displayName?: string;
  timezone?: string;
};

export type AuthSession = { user: User; accessToken: string };

export type AuthContextValue = {
  state: AuthState;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User) => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
