import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// AuthProvider bootstraps by calling /api/auth/refresh on mount. Stub the
// apiClient so the call fails fast (no real network in jsdom) and we land
// in 'unauthenticated' without hanging the test.
vi.mock('./lib/apiClient', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('not authed')),
    post: vi.fn().mockRejectedValue(new Error('not authed')),
    patch: vi.fn().mockRejectedValue(new Error('not authed')),
    put: vi.fn().mockRejectedValue(new Error('not authed')),
    delete: vi.fn().mockRejectedValue(new Error('not authed')),
    upload: vi.fn().mockRejectedValue(new Error('not authed')),
  },
  ApiError: class ApiError extends Error {},
  setAccessToken: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
  configureApiClient: vi.fn(),
  getBaseUrl: vi.fn().mockReturnValue(''),
}));

import App from './App';

describe('<App />', () => {
  it('renders the home page at the index route', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /building careers/i }),
    ).toBeInTheDocument();
  });

  it('renders the persistent layout chrome', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
