import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ReactNode } from 'react';
import Layout from './Layout';

function renderLayoutWith(child: ReactNode) {
  const router = createMemoryRouter(
    [{ path: '/', element: <Layout />, children: [{ index: true, element: child }] }],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('<Layout />', () => {
  it('renders the brand link to home', () => {
    renderLayoutWith(<div>child</div>);
    const brandLink = screen.getByRole('link', { name: /entractus recruitment/i });
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('renders banner, main, and contentinfo landmarks', () => {
    renderLayoutWith(<div>child</div>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('exposes a skip-to-content link', () => {
    renderLayoutWith(<div>child</div>);
    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toHaveAttribute('href', '#main-content');
  });

  it('renders nested route content via the outlet', () => {
    renderLayoutWith(<p>routed-child-content</p>);
    expect(screen.getByText('routed-child-content')).toBeInTheDocument();
  });

  it('renders the current year in the footer copyright', () => {
    renderLayoutWith(<div>child</div>);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`${year} Entractus Recruitment`, 'i'))).toBeInTheDocument();
  });
});
