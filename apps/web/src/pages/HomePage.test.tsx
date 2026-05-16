import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import HomePage from './HomePage';

function renderHome() {
  const router = createMemoryRouter([{ path: '/', element: <HomePage /> }], {
    initialEntries: ['/'],
  });
  return render(<RouterProvider router={router} />);
}

describe('<HomePage />', () => {
  it('renders the hero headline as the page H1', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { level: 1, name: /building careers/i }),
    ).toBeInTheDocument();
  });

  it('exposes the hero as a labelled region', () => {
    renderHome();
    expect(screen.getByRole('region', { name: /building careers/i })).toBeInTheDocument();
  });

  it('links the Job Openings CTA to /jobs', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /browse job openings/i })).toHaveAttribute(
      'href',
      '/jobs',
    );
  });

  it('links the Hire Talent CTA to /contact', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /hire talent/i })).toHaveAttribute('href', '/contact');
  });
});
