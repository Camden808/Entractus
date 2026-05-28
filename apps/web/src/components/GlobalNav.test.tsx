import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import GlobalNav from './GlobalNav';
import { MockAuthProvider, makeAuthValue, TEST_USER } from '../test/auth-test-utils';
import type { AuthContextValue } from '../lib/auth';

function renderNav(initialPath = '/', authValue?: AuthContextValue) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <MockAuthProvider value={authValue}>
            <GlobalNav />
            <button type="button" data-testid="outside">
              outside
            </button>
            <main>
              <Outlet />
            </main>
          </MockAuthProvider>
        ),
        children: [
          { index: true, element: <p>home page</p> },
          { path: 'about', element: <p>about page</p> },
          { path: 'jobs', element: <p>jobs page</p> },
          { path: 'employers', element: <p>employers page</p> },
          { path: 'contact', element: <p>contact page</p> },
          { path: 'blog', element: <p>blog page</p> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

describe('<GlobalNav /> — desktop tree', () => {
  it('renders Hire Employees and Job Openings buttons routing to the right paths', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /hire employees/i })).toHaveAttribute(
      'href',
      '/employers',
    );
    expect(screen.getByRole('link', { name: /job openings/i })).toHaveAttribute('href', '/jobs');
  });

  it('renders Email Us and Phone Us as mailto and tel links', () => {
    renderNav();
    const email = screen.getByRole('link', { name: /email us/i });
    const phone = screen.getByRole('link', { name: /phone us/i });
    expect(email.getAttribute('href')).toMatch(/^mailto:/);
    expect(phone.getAttribute('href')).toMatch(/^tel:/);
  });
});

describe('<GlobalNav /> — dropdown menu', () => {
  it('is closed by default with aria-expanded=false', () => {
    renderNav();
    const trigger = screen.getByRole('button', { name: /^menu$/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the dropdown on trigger click and lists the five expected items', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole('button', { name: /^menu$/i }));
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(5);
    expect(menu).toBeInTheDocument();
    expect(items.map((item) => item.textContent)).toEqual([
      'For Employers',
      'For Job Seekers',
      'About',
      'Blog',
      'Contact Us',
    ]);
    expect(items[0]).toHaveAttribute('href', '/employers');
    expect(items[1]).toHaveAttribute('href', '/jobs');
    expect(items[2]).toHaveAttribute('href', '/about');
    expect(items[3]).toHaveAttribute('href', '/blog');
    expect(items[4]).toHaveAttribute('href', '/contact');
  });

  it('toggles closed when the trigger is clicked again', async () => {
    const user = userEvent.setup();
    renderNav();
    const trigger = screen.getByRole('button', { name: /^menu$/i });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when clicking outside the dropdown', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole('button', { name: /^menu$/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole('button', { name: /^menu$/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes after navigating to a new route via a menu item', async () => {
    const user = userEvent.setup();
    const { router } = renderNav();
    await user.click(screen.getByRole('button', { name: /^menu$/i }));
    await user.click(screen.getByRole('menuitem', { name: /^about$/i }));
    expect(router.state.location.pathname).toBe('/about');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('<GlobalNav /> — mobile hamburger', () => {
  it('toggles the mobile menu open and closed', async () => {
    const user = userEvent.setup();
    renderNav();
    const trigger = screen.getByRole('button', { name: /open menu/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('shows every primary, contact, and dropdown item when open', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getAllByRole('link', { name: /hire employees/i })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /job openings/i })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /email us/i })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /phone us/i })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /^for employers$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^for job seekers$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^about$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^blog$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^contact us$/i })).toBeInTheDocument();
  });

  it('closes the mobile menu after navigating', async () => {
    const user = userEvent.setup();
    const { router } = renderNav();
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(screen.getByRole('link', { name: /^contact us$/i }));
    expect(router.state.location.pathname).toBe('/contact');
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('closes the mobile menu when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });
});

describe('<GlobalNav /> — auth state', () => {
  it('shows a Log in link and hides Account / Log out when unauthenticated', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /^log in$/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /^account$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^log out$/i })).not.toBeInTheDocument();
  });

  it('shows Account link and Log out button (and hides Log in) when authenticated', () => {
    renderNav('/', makeAuthValue({ state: { status: 'authenticated', user: TEST_USER } }));
    expect(screen.getByRole('link', { name: /^account$/i })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('button', { name: /^log out$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^log in$/i })).not.toBeInTheDocument();
  });

  it('clicking Log out calls auth.logout', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderNav('/', makeAuthValue({ state: { status: 'authenticated', user: TEST_USER }, logout }));

    await user.click(screen.getByRole('button', { name: /^log out$/i }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
