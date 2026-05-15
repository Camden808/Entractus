import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';

const CONTACT_EMAIL = 'hello@entractus.example';
const CONTACT_PHONE_DISPLAY = '(555) 010-2024';
const CONTACT_PHONE_TEL = '+15550102024';

const PRIMARY_BUTTONS = [
  { label: 'Hire Employees', to: '/employers' },
  { label: 'Job Openings', to: '/jobs' },
] as const;

const DROPDOWN_ITEMS = [
  { label: 'For Employers', to: '/employers' },
  { label: 'For Job Seekers', to: '/jobs' },
  { label: 'About', to: '/about' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact Us', to: '/contact' },
] as const;

const desktopButtonClass =
  'inline-flex items-center justify-center rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400';

const desktopGhostClass =
  'inline-flex items-center justify-center rounded-md border border-brand-200 bg-surface px-4 py-2 text-sm font-medium text-brand-700 transition hover:border-brand-400 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400';

const mobileItemClass =
  'block rounded-md px-3 py-2 text-base font-medium text-ink hover:bg-brand-50 hover:text-brand-800';

function GlobalNav() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement | null>(null);
  const dropdownMenuId = useId();
  const mobileMenuId = useId();

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <nav aria-label="Primary" className="flex items-center gap-3">
      <ul className="hidden items-center gap-2 md:flex">
        {PRIMARY_BUTTONS.map(({ label, to }) => (
          <li key={to + label}>
            <Link to={to} className={desktopButtonClass}>
              {label}
            </Link>
          </li>
        ))}
        <li>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className={desktopGhostClass}
            aria-label={`Email us at ${CONTACT_EMAIL}`}
          >
            Email Us
          </a>
        </li>
        <li>
          <a
            href={`tel:${CONTACT_PHONE_TEL}`}
            className={desktopGhostClass}
            aria-label={`Phone us at ${CONTACT_PHONE_DISPLAY}`}
          >
            Phone Us
          </a>
        </li>
        <li ref={dropdownRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            aria-controls={dropdownMenuId}
            onClick={() => setDropdownOpen((open) => !open)}
            className={desktopGhostClass}
          >
            Menu
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="ml-2 h-4 w-4"
              fill="currentColor"
            >
              <path
                d="M5.5 7.5l4.5 4.5 4.5-4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </button>
          {dropdownOpen && (
            <ul
              id={dropdownMenuId}
              role="menu"
              className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-surface shadow-lg"
            >
              {DROPDOWN_ITEMS.map(({ label, to }) => (
                <li key={to + label} role="none">
                  <NavLink
                    to={to}
                    role="menuitem"
                    end
                    onClick={() => setDropdownOpen(false)}
                    className={({ isActive }) =>
                      `block px-4 py-2 text-sm text-ink hover:bg-brand-50 hover:text-brand-800 ${
                        isActive ? 'bg-brand-50 text-brand-800' : ''
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>

      <button
        type="button"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        aria-controls={mobileMenuId}
        onClick={() => setMobileOpen((open) => !open)}
        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-surface p-2 text-ink hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 md:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div
          id={mobileMenuId}
          className="absolute left-0 right-0 top-full z-10 border-b border-slate-200 bg-surface shadow-md md:hidden"
        >
          <ul className="mx-auto max-w-6xl space-y-1 px-6 py-4">
            {PRIMARY_BUTTONS.map(({ label, to }) => (
              <li key={`mobile-${to}-${label}`}>
                <Link to={to} onClick={() => setMobileOpen(false)} className={mobileItemClass}>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                onClick={() => setMobileOpen(false)}
                className={mobileItemClass}
              >
                Email Us
              </a>
            </li>
            <li>
              <a
                href={`tel:${CONTACT_PHONE_TEL}`}
                onClick={() => setMobileOpen(false)}
                className={mobileItemClass}
              >
                Phone Us
              </a>
            </li>
            {DROPDOWN_ITEMS.map(({ label, to }) => (
              <li key={`mobile-more-${to}-${label}`}>
                <NavLink
                  to={to}
                  end
                  onClick={() => setMobileOpen(false)}
                  className={mobileItemClass}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

export default GlobalNav;
