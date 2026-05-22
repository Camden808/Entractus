import { Link } from 'react-router';

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  publishedOn: string;
  readingMinutes: number;
  tags: ReadonlyArray<string>;
};

const POSTS: ReadonlyArray<BlogPost> = [
  {
    slug: 'hiring-for-time-sensitive-projects',
    title: 'Hiring for time-sensitive Construction projects without burning the budget',
    excerpt:
      'When a project schedule slips, every day matters. Here is how we help clients staff up quickly with temp and temp-to-perm placements without overspending on agency markup.',
    author: 'Entractus Recruitment',
    publishedOn: '2026-04-22',
    readingMinutes: 5,
    tags: ['Employers', 'Construction'],
  },
  {
    slug: 'engineering-resume-checklist',
    title: 'The Engineering resume checklist hiring managers actually read',
    excerpt:
      'Most engineering resumes never make it past the first scan. We break down the seven things our placement partners look for in the first thirty seconds.',
    author: 'Entractus Recruitment',
    publishedOn: '2026-04-08',
    readingMinutes: 4,
    tags: ['Job Seekers', 'Engineering'],
  },
  {
    slug: 'temp-to-perm-trial-period',
    title: 'Why a temp-to-perm trial period works for both sides',
    excerpt:
      'Permanent hiring decisions carry real risk. A short trial gives candidates a chance to see the work and gives employers data they cannot get from interviews alone.',
    author: 'Entractus Recruitment',
    publishedOn: '2026-03-19',
    readingMinutes: 6,
    tags: ['Employers', 'Job Seekers'],
  },
  {
    slug: 'covering-an-employee-on-leave',
    title: 'Covering an employee on leave: a 10-day playbook',
    excerpt:
      'Medical leave and vacation cover do not have to mean lost productivity. This is the lightweight process we use to land the right backfill in under two weeks.',
    author: 'Entractus Recruitment',
    publishedOn: '2026-03-02',
    readingMinutes: 4,
    tags: ['Employers'],
  },
];

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function BlogPage() {
  return (
    <article aria-labelledby="blog-heading" className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          Insights & guides
        </p>
        <h1 id="blog-heading" className="text-3xl font-bold text-brand-900 md:text-4xl">
          The Entractus Blog
        </h1>
        <p className="text-base text-ink-muted">
          Notes from the Construction and Engineering recruitment desk &mdash; what we&rsquo;re
          seeing in the market and how we help clients and candidates land the right match.
        </p>
      </header>

      <ul aria-label="Blog posts" className="space-y-6">
        {POSTS.map((post) => (
          <li
            key={post.slug}
            className="rounded-xl border border-brand-100 bg-surface p-5 shadow-sm md:p-6"
          >
            <article aria-labelledby={`post-${post.slug}-title`} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <time dateTime={post.publishedOn}>{formatDate(post.publishedOn)}</time>
                <span aria-hidden="true">&middot;</span>
                <span>{post.readingMinutes} min read</span>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2
                id={`post-${post.slug}-title`}
                className="text-xl font-semibold text-brand-900 md:text-2xl"
              >
                {post.title}
              </h2>
              <p className="text-sm leading-relaxed text-ink-muted md:text-base">{post.excerpt}</p>
              <p className="text-xs text-ink-muted">
                By <span className="font-medium text-ink">{post.author}</span>
              </p>
            </article>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="blog-cta-heading"
        className="rounded-xl border border-brand-100 bg-brand-50 p-6 md:p-8"
      >
        <h2 id="blog-cta-heading" className="sr-only">
          Want to talk to a recruiter?
        </h2>
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-base font-medium text-brand-900">
            Have a hiring question we should write about?
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center rounded-md bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Contact us
          </Link>
        </div>
      </section>
    </article>
  );
}

export default BlogPage;
