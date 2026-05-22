import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import AboutPage from './AboutPage';

function renderAbout() {
  const router = createMemoryRouter([{ path: '/', element: <AboutPage /> }], {
    initialEntries: ['/'],
  });
  return render(<RouterProvider router={router} />);
}

describe('<AboutPage />', () => {
  it('uses the building-careers headline as the page H1', () => {
    renderAbout();
    expect(
      screen.getByRole('heading', { level: 1, name: /building careers in construction/i }),
    ).toBeInTheDocument();
  });

  it('renders the story and how-we-work sections', () => {
    renderAbout();
    expect(screen.getByRole('heading', { level: 2, name: /our story/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /how we work/i })).toBeInTheDocument();
  });

  it('lists the four values', () => {
    renderAbout();
    const valuesRegion = screen.getByRole('region', { name: /how we work/i });
    const items = within(valuesRegion).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/industry expertise/i);
    expect(items[1]).toHaveTextContent(/flexible placement options/i);
    expect(items[2]).toHaveTextContent(/candidate-first screening/i);
    expect(items[3]).toHaveTextContent(/respects the work/i);
  });

  it('links the contact CTA to /contact and the jobs CTA to /jobs', () => {
    renderAbout();
    expect(screen.getByRole('link', { name: /contact our team/i })).toHaveAttribute(
      'href',
      '/contact',
    );
    expect(screen.getByRole('link', { name: /browse job openings/i })).toHaveAttribute(
      'href',
      '/jobs',
    );
  });
});
