import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

const cases: Array<{ path: string; heading: RegExp }> = [
  { path: '/', heading: /^building careers/i },
  { path: '/employers', heading: /^recruitment service request$/i },
  { path: '/contact', heading: /^contact us$/i },
  { path: '/jobs', heading: /^job openings$/i },
  { path: '/about', heading: /building careers in construction/i },
  { path: '/blog', heading: /^the entractus blog$/i },
  { path: '/login', heading: /^log in$/i },
  { path: '/register', heading: /^create an account$/i },
  { path: '/forgot-password', heading: /^forgot your password\?$/i },
  { path: '/reset-password', heading: /^reset your password$/i },
  { path: '/account', heading: /^your account$/i },
  { path: '/admin/jobs', heading: /^manage job postings$/i },
];

describe('router', () => {
  for (const { path, heading } of cases) {
    it(`renders the expected page at ${path}`, () => {
      renderAt(path);
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
