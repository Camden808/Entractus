import { useEffect, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
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

type Facets = {
  states: ReadonlyArray<string>;
  cities: ReadonlyArray<string>;
  companies: ReadonlyArray<string>;
};

const PAGE_INTRO =
  "Whether you're looking for a permanent or temporary job, browse our open positions below. If you find an opening that matches your skills and experience, apply directly from the listing.";

const SEARCH_DEBOUNCE_MS = 300;
const FACET_PAGE_SIZE = 100;

const TYPE_OPTIONS = [
  'Temporary',
  'Temp To Perm',
  'Direct Hire',
  'Full Time',
  'Part Time',
] as const;

const FILTER_KEYS = ['q', 'state', 'city', 'type', 'company'] as const;

function formatPostedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function uniqueSorted(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values.filter((v) => v.trim().length > 0))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function deriveFacets(items: ReadonlyArray<Job>): Facets {
  return {
    states: uniqueSorted(items.map((j) => j.state)),
    cities: uniqueSorted(items.map((j) => j.city)),
    companies: uniqueSorted(items.map((j) => j.company)),
  };
}

function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.message} (${err.status})`;
  if (err instanceof Error) return err.message;
  return 'Unexpected error.';
}

function buildJobsUrl(filters: {
  q: string;
  state: string;
  city: string;
  type: string;
  company: string;
}): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/api/jobs?${qs}` : '/api/jobs';
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

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-10 text-center"
    >
      <p className="text-lg font-medium text-brand-900">
        {hasFilters ? 'No openings match the current filters.' : 'No job openings right now.'}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        {hasFilters
          ? 'Try widening your search or clearing a filter.'
          : 'Check back soon — new positions go up regularly.'}
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

function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const stateFilter = searchParams.get('state') ?? '';
  const cityFilter = searchParams.get('city') ?? '';
  const typeFilter = searchParams.get('type') ?? '';
  const companyFilter = searchParams.get('company') ?? '';
  const hasFilters =
    Boolean(q) ||
    Boolean(stateFilter) ||
    Boolean(cityFilter) ||
    Boolean(typeFilter) ||
    Boolean(companyFilter);

  // Local input value for the debounced search box. Sync from URL on
  // external navigation (browser back/forward, clear-filters) via the
  // shadow-state pattern so we don't violate set-state-in-effect.
  const [qInput, setQInput] = useState(q);
  const [lastSyncedQ, setLastSyncedQ] = useState(q);
  if (q !== lastSyncedQ) {
    setLastSyncedQ(q);
    setQInput(q);
  }

  const [status, setStatus] = useState<Status>('loading');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [facets, setFacets] = useState<Facets>({ states: [], cities: [], companies: [] });

  // One-shot facets snapshot. We swallow errors — the dropdowns just stay
  // empty, which is degraded but not broken.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<JobsResponse>(`/api/jobs?pageSize=${FACET_PAGE_SIZE}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setFacets(deriveFacets(data.items));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Results fetch — re-runs whenever URL filters change.
  useEffect(() => {
    const controller = new AbortController();
    const url = buildJobsUrl({
      q,
      state: stateFilter,
      city: cityFilter,
      type: typeFilter,
      company: companyFilter,
    });
    api
      .get<JobsResponse>(url, { signal: controller.signal })
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
  }, [q, stateFilter, cityFilter, typeFilter, companyFilter, reloadKey]);

  // Debounce qInput → ?q= URL param so we don't navigate on every keystroke.
  useEffect(() => {
    if (qInput === q) return;
    const id = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (qInput) next.set('q', qInput);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [qInput, q, setSearchParams]);

  function updateFilter(key: 'state' | 'city' | 'type' | 'company', value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
    // Trigger a refresh so we don't have to wait for users to scroll.
    setStatus('loading');
  }

  function handleClearFilters() {
    setQInput('');
    setSearchParams(new URLSearchParams());
    setStatus('loading');
  }

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

      <section
        aria-label="Search and filter"
        className="space-y-4 rounded-xl border border-brand-100 bg-surface p-5 shadow-sm"
      >
        <Input
          label="Search by job title"
          type="search"
          placeholder="e.g. engineer, project manager"
          value={qInput}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQInput(e.target.value)}
          autoComplete="off"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="State"
            placeholder="All states"
            value={stateFilter}
            onChange={(e) => updateFilter('state', e.target.value)}
            options={[
              { value: '', label: 'All states' },
              ...facets.states.map((s) => ({ value: s, label: s })),
            ]}
          />
          <Select
            label="City"
            placeholder="All cities"
            value={cityFilter}
            onChange={(e) => updateFilter('city', e.target.value)}
            options={[
              { value: '', label: 'All cities' },
              ...facets.cities.map((c) => ({ value: c, label: c })),
            ]}
          />
          <Select
            label="Type"
            placeholder="All types"
            value={typeFilter}
            onChange={(e) => updateFilter('type', e.target.value)}
            options={[
              { value: '', label: 'All types' },
              ...TYPE_OPTIONS.map((t) => ({ value: t, label: t })),
            ]}
          />
          <Select
            label="Company"
            placeholder="All companies"
            value={companyFilter}
            onChange={(e) => updateFilter('company', e.target.value)}
            options={[
              { value: '', label: 'All companies' },
              ...facets.companies.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>

        {hasFilters && (
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </section>

      {status === 'loading' && <GallerySkeleton />}
      {status === 'empty' && <EmptyState hasFilters={hasFilters} />}
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
