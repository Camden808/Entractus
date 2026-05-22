import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import BlogPage from './BlogPage';

function renderBlog() {
  const router = createMemoryRouter([{ path: '/', element: <BlogPage /> }], {
    initialEntries: ['/'],
  });
  return render(<RouterProvider router={router} />);
}

describe('<BlogPage />', () => {
  it('uses the Entractus Blog headline as the page H1', () => {
    renderBlog();
    expect(
      screen.getByRole('heading', { level: 1, name: /the entractus blog/i }),
    ).toBeInTheDocument();
  });

  it('renders the stubbed post list', () => {
    renderBlog();
    const list = screen.getByRole('list', { name: /blog posts/i });
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(
      within(items[0]!).getByRole('heading', { level: 2, name: /time-sensitive construction/i }),
    ).toBeInTheDocument();
  });

  it('includes metadata (publish date and reading time) on each post', () => {
    renderBlog();
    const list = screen.getByRole('list', { name: /blog posts/i });
    const items = within(list).getAllByRole('listitem');
    for (const item of items) {
      expect(within(item).getByText(/\d+ min read/)).toBeInTheDocument();
      const time = item.querySelector('time');
      expect(time).not.toBeNull();
      expect(time!.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('links the Contact us CTA to /contact', () => {
    renderBlog();
    expect(screen.getByRole('link', { name: /^contact us$/i })).toHaveAttribute('href', '/contact');
  });
});
