import { Link } from 'react-router';

function HomePage() {
  return (
    <section
      aria-labelledby="home-heading"
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 text-white shadow-xl"
    >
      <div className="grid gap-10 px-6 py-12 md:grid-cols-2 md:items-center md:gap-12 md:px-12 md:py-16 lg:px-16 lg:py-20">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">
            Construction &amp; Engineering recruitment
          </p>
          <h1 id="home-heading" className="text-4xl font-bold leading-tight md:text-5xl">
            Building careers, staffing the work that builds the world.
          </h1>
          <p className="text-lg text-brand-50">
            Entractus connects employers with skilled candidates across temp, temp-to-hire, and
            direct placement &mdash; so you can keep projects moving and your next great role within
            reach.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/jobs"
              className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-brand-800 shadow transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Browse Job Openings
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-md border border-white/40 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Hire Talent
            </Link>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="relative hidden aspect-[4/3] overflow-hidden rounded-xl bg-white/10 shadow-inner ring-1 ring-white/20 md:block"
        >
          <svg
            viewBox="0 0 400 300"
            className="absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1f4d83" stopOpacity="0" />
                <stop offset="100%" stopColor="#0c1f37" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <rect width="400" height="300" fill="url(#sky)" />
            <g stroke="white" strokeWidth="2" fill="none" opacity="0.85">
              <path d="M40 240 L40 80 L240 80" />
              <path d="M40 80 L20 110" />
              <path d="M120 80 L120 240" />
              <path d="M40 140 L240 140" />
              <path d="M40 200 L240 200" />
              <path d="M240 80 L240 240" />
              <circle cx="40" cy="80" r="4" fill="white" />
              <circle cx="240" cy="80" r="4" fill="white" />
            </g>
            <g fill="white" opacity="0.9">
              <rect x="270" y="160" width="22" height="80" />
              <rect x="300" y="120" width="22" height="120" />
              <rect x="330" y="180" width="22" height="60" />
              <rect x="360" y="100" width="22" height="140" />
            </g>
            <g stroke="white" strokeWidth="1.5" opacity="0.5">
              <line x1="0" y1="240" x2="400" y2="240" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}

export default HomePage;
