import { useEffect, useState } from 'react';
import Button from '../components/Button';
import { api, ApiError } from '../lib/apiClient';

export type Job = {
  id: string;
  title: string;
  state: string;
  city: string;
  type: string;
  company: string;
  postedDate: string;
  description: string;
};

type JobsResponse = {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
};

type Status = 'loading' | 'success' | 'empty' | 'error';

const PAGE_INTRO =
  "Whether you're looking for a permanent or temporary job, browse our open positions below. If you find an opening that matches your skills and experience, apply directly from the listing.";

function formatPostedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function JobCard({ job }: { job: Job }) {
  return (
    <article
      aria-labelledby={`job-${job.id}-title`}
      className="flex h-full flex-col rounded-xl border border-brand-100 bg-surface p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <h3 id={`job-${job.id}-title`} className="text-lg font-semibold text-brand-900">
        {job.title}
      </h3>
      <dl className="mt-3 space-y-1 text-sm text-ink-muted">
        <div className="flex gap-2">
          <dt className="sr-only">Location</dt>
          <dd>
            {job.city}, {job.state}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">Company</dt>
          <dd>{job.company}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700">
          {job.type}
        </span>
        <span className="text-ink-muted">
          Posted{' '}
          <time dateTime={job.postedDate} className="font-medium text-ink">
            {formatPostedDate(job.postedDate)}
          </time>
        </span>
      </div>
    </article>
  );
}

function GallerySkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label="Loading job openings"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}>
          <div className="h-44 animate-pulse rounded-xl border border-brand-100 bg-brand-50/40" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div
      role="status"
      className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-10 text-center"
    >
      <p className="text-lg font-medium text-brand-900">No job openings right now.</p>
      <p className="mt-1 text-sm text-ink-muted">
        Check back soon &mdash; new positions go up regularly.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6 text-center"
    >
      <div>
        <p className="text-base font-semibold text-red-800">
          We couldn&rsquo;t load the job listings.
        </p>
        <p className="mt-1 text-sm text-red-700">{message}</p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.message} (${err.status})`;
  if (err instanceof Error) return err.message;
  return 'Unexpected error.';
}

function JobsPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  // Bumping this re-runs the fetch effect. Used by the retry button.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<JobsResponse>('/api/jobs', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setJobs(data.items);
        setStatus(data.items.length === 0 ? 'empty' : 'success');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(toErrorMessage(err));
        setStatus('error');
      });
    return () => controller.abort();
  }, [reloadKey]);

  function handleRetry() {
    setStatus('loading');
    setErrorMessage('');
    setReloadKey((k) => k + 1);
  }

  return (
    <section aria-labelledby="jobs-heading" className="mx-auto max-w-6xl space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          For Job Seekers
        </p>
        <h1 id="jobs-heading" className="text-3xl font-bold text-brand-900 md:text-4xl">
          Job Openings
        </h1>
        <p className="max-w-3xl text-base text-ink-muted">{PAGE_INTRO}</p>
      </div>

      {status === 'loading' && <GallerySkeleton />}
      {status === 'empty' && <EmptyState />}
      {status === 'error' && <ErrorState message={errorMessage} onRetry={handleRetry} />}
      {status === 'success' && (
        <ul aria-label="Job openings" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default JobsPage;
