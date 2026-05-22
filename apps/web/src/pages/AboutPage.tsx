import { Link } from 'react-router';

const VALUES = [
  {
    title: 'Industry expertise',
    body: 'Our recruiters spend their careers in Construction and Engineering — they speak the same language as the hiring managers they place candidates with.',
  },
  {
    title: 'Flexible placement options',
    body: 'Temporary, temp-to-perm, and direct hire. Whichever model fits the role, the budget, and the timeline.',
  },
  {
    title: 'Candidate-first screening',
    body: 'Every candidate is vetted for skills, certifications, and the day-to-day fit that keeps projects on schedule.',
  },
  {
    title: 'Response that respects the work',
    body: "Job sites and engineering teams can't wait days for a reply. We move at the pace the work demands.",
  },
];

function AboutPage() {
  return (
    <article aria-labelledby="about-heading" className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          About Entractus
        </p>
        <h1 id="about-heading" className="text-3xl font-bold text-brand-900 md:text-4xl">
          Building careers in Construction and Engineering.
        </h1>
      </header>

      <section aria-labelledby="story-heading" className="space-y-4">
        <h2 id="story-heading" className="text-xl font-semibold text-ink">
          Our story
        </h2>
        <p className="text-base leading-relaxed text-ink-muted">
          Entractus Recruitment was founded to solve a recurring problem in the Construction and
          Engineering industry: skilled candidates and great employers had a hard time finding each
          other. We started by building deep relationships with both sides of the table, and today
          we place engineers, project managers, tradespeople, and field staff across the country.
        </p>
        <p className="text-base leading-relaxed text-ink-muted">
          Whether a client needs to staff a time-sensitive project, cover an employee on leave, or
          fill a permanent role with the right long-term hire, we tailor the search to the job — not
          the other way around.
        </p>
      </section>

      <section aria-labelledby="values-heading" className="space-y-4">
        <h2 id="values-heading" className="text-xl font-semibold text-ink">
          How we work
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {VALUES.map((value) => (
            <li
              key={value.title}
              className="rounded-lg border border-brand-100 bg-surface p-4 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-brand-800">{value.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{value.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="cta-heading"
        className="rounded-xl border border-brand-100 bg-brand-50 p-6 md:p-8"
      >
        <h2 id="cta-heading" className="sr-only">
          Get in touch
        </h2>
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-base font-medium text-brand-900">
            Hiring, or looking for your next role?
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-md bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              Contact our team
            </Link>
            <Link
              to="/jobs"
              className="inline-flex items-center justify-center rounded-md border border-brand-200 bg-surface px-5 py-3 text-sm font-semibold text-brand-700 transition hover:border-brand-400 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
            >
              Browse job openings
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}

export default AboutPage;
