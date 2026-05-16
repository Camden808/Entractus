import { Link } from 'react-router';

const REASONS = [
  'Staffing a project that is time-sensitive while saving on costs',
  'Finding the perfect candidate for a permanent position',
  'Covering for employees on vacation or medical leave',
  'Allowing candidates to try the job out before accepting an offer',
];

function EmployersPage() {
  return (
    <article aria-labelledby="employers-heading" className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          For Employers
        </p>
        <h1 id="employers-heading" className="text-3xl font-bold text-brand-900 md:text-4xl">
          Recruitment Service Request
        </h1>
      </header>

      <p className="text-lg leading-relaxed text-ink-muted">
        Entractus Recruitment is one of the leading placement firms in the Engineering and
        Construction industry. We provide a variety of recruitment solutions designed to meet our
        clients&rsquo; needs, including temp, temp to hire and permanent placement. Whether
        you&rsquo;re attempting to fill a permanent role, cover an employee on leave or you simply
        need some extra help for a couple of days, we are eager to serve.
      </p>

      <section aria-labelledby="reasons-heading" className="space-y-4">
        <h2 id="reasons-heading" className="text-xl font-semibold text-ink">
          Clients utilize our recruitment services for a variety of reasons:
        </h2>
        <ul className="space-y-2 text-ink">
          {REASONS.map((reason) => (
            <li key={reason} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-xl border border-brand-100 bg-brand-50 p-6 md:p-8">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-base font-medium text-brand-900">
            Ready to talk about your hiring needs?
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center rounded-md bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Contact Us Today
          </Link>
        </div>
      </div>
    </article>
  );
}

export default EmployersPage;
