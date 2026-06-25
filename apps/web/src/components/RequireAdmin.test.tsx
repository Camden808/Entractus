import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import RequireAdmin from './RequireAdmin';
import { MockAuthProvider, makeAuthValue, TEST_USER } from '../test/auth-test-utils';
import type { AuthContextValue } from '../lib/auth';

function ProtectedContent() {
  return <h1>Manage Job Postings</h1>;
}

function renderGuard(initialPath = '/admin/jobs', authValue?: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        path: '/admin/jobs',
        element: (
          <RequireAdmin>
            <ProtectedContent />
          </RequireAdmin>
        ),
      },
      { path: '/login', element: <h1>Log In</h1> },
      { path: '/', element: <h1>Home</h1> },
    ],
    { initialEntries: [initialPath] },
  );
  return render(
    <MockAuthProvider value={authValue}>
      <RouterProvider router={router} />
    </MockAuthProvider>,
  );
}

describe('<RequireAdmin />', () => {
  it('shows a checking-access placeholder while auth is loading', () => {
    renderGuard('/admin/jobs', makeAuthValue({ state: { status: 'loading' } }));
    expect(screen.getByRole('status')).toHaveTextContent(/checking your access/i);
    expect(screen.queryByRole('heading', { name: /manage job postings/i })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', async () => {
    renderGuard('/admin/jobs', makeAuthValue({ state: { status: 'unauthenticated' } }));
    expect(await screen.findByRole('heading', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /manage job postings/i })).not.toBeInTheDocument();
  });

  it('redirects a non-admin authenticated user to the home page', async () => {
    renderGuard(
      '/admin/jobs',
      makeAuthValue({
        state: {
          status: 'authenticated',
          user: { ...TEST_USER, role: 'user' },
        },
      }),
    );
    expect(await screen.findByRole('heading', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /manage job postings/i })).not.toBeInTheDocument();
  });

  it('renders the children for an authenticated admin', () => {
    renderGuard(
      '/admin/jobs',
      makeAuthValue({
        state: {
          status: 'authenticated',
          user: { ...TEST_USER, role: 'admin' },
        },
      }),
    );
    expect(screen.getByRole('heading', { name: /manage job postings/i })).toBeInTheDocument();
  });
});
