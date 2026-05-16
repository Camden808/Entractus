import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import EmployersPage from './EmployersPage';

function renderEmployers() {
  const router = createMemoryRouter([{ path: '/', element: <EmployersPage /> }], {
    initialEntries: ['/'],
  });
  return render(<RouterProvider router={router} />);
}

describe('<EmployersPage />', () => {
  it('uses Recruitment Service Request as the page H1', () => {
    renderEmployers();
    expect(
      screen.getByRole('heading', { level: 1, name: /^recruitment service request$/i }),
    ).toBeInTheDocument();
  });

  it('renders the leading-placement intro paragraph', () => {
    renderEmployers();
    expect(
      screen.getByText(/leading placement firms in the engineering and construction industry/i),
    ).toBeInTheDocument();
  });

  it('lists every reason clients use the service', () => {
    renderEmployers();
    const reasonsRegion = screen.getByRole('region', {
      name: /clients utilize our recruitment services/i,
    });
    const items = within(reasonsRegion).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/staffing a project that is time-sensitive/i);
    expect(items[1]).toHaveTextContent(/perfect candidate for a permanent position/i);
    expect(items[2]).toHaveTextContent(/covering for employees on vacation or medical leave/i);
    expect(items[3]).toHaveTextContent(/try the job out before accepting an offer/i);
  });

  it('routes the Contact Us Today CTA to /contact', () => {
    renderEmployers();
    expect(screen.getByRole('link', { name: /contact us today/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });
});
