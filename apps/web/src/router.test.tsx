import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';
import { MockAuthProvider, makeAuthValue, TEST_USER } from './test/auth-test-utils';
import type { AuthContextValue } from './lib/auth';

function renderAt(path: string, authValue?: AuthContextValue) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <MockAuthProvider value={authValue}>
      <RouterProvider router={router} />
    </MockAuthProvider>,
  );
}

const AUTHED = makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } });

const cases: Array<{ path: string; heading: RegExp; auth?: AuthContextValue }> = [
  { path: '/', heading: /^building careers/i },
  { path: '/employers', heading: /^recruitment service request$/i },
  { path: '/contact', heading: /^contact us$/i },
  { path: '/jobs', heading: /^job openings$/i },
  { path: '/about', heading: /building careers in construction/i },
  { path: '/blog', heading: /^the entractus blog$/i },
  { path: '/login', heading: /^log in$/i },
  { path: '/register', heading: /^create an account$/i },
  { path: '/forgot-password', heading: /^forgot your password\?$/i },
  // ResetPasswordPage requires a ?token= to render the form; without one it
  // shows an error heading instead.
  { path: '/reset-password?token=test-token', heading: /^reset your password$/i },
  // AccountPage redirects unauthenticated visitors to /login, so we pass an
  // authenticated session to exercise the rendered route.
  { path: '/account', heading: /^your account$/i, auth: AUTHED },
  { path: '/admin/jobs', heading: /^manage job postings$/i },
];

describe('router', () => {
  for (const { path, heading, auth } of cases) {
    it(`renders the expected page at ${path}`, () => {
      renderAt(path, auth);
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    });
  }

  it('renders the not-found page for an unknown path', () => {
    renderAt('/this-route-does-not-exist');
    expect(
      screen.getByRole('heading', { level: 1, name: /^page not found$/i }),
    ).toBeInTheDocument();
  });

  it('keeps the layout chrome on every route', () => {
    renderAt('/jobs');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
