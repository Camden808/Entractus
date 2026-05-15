import { Link, Outlet } from 'react-router';
import GlobalNav from './GlobalNav';

function Layout() {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-brand-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="relative border-b border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
          <Link
            to="/"
            className="font-display text-xl font-semibold tracking-tight text-brand-800 hover:text-brand-600"
          >
            Entractus Recruitment
          </Link>
          <GlobalNav />
        </div>
      </header>

      <main
        id="main-content"
        role="main"
        className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 lg:px-10"
      >
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-ink-muted lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>&copy; {year} Entractus Recruitment. All rights reserved.</p>
          <p>Construction &amp; Engineering recruitment specialists.</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
