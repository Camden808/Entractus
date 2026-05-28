import { useEffect, useState, type FormEvent } from 'react';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import { api, ApiError } from '../lib/apiClient';

type Job = {
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

type FormMode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; job: Job };

type Banner = { kind: 'success' | 'error'; message: string } | null;

const TYPE_OPTIONS = [
  'Temporary',
  'Temp To Perm',
  'Direct Hire',
  'Full Time',
  'Part Time',
] as const;

const EMPTY_FORM = {
  title: '',
  state: '',
  city: '',
  type: '',
  company: '',
  description: '',
};

type FormState = typeof EMPTY_FORM;
type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim()) errors.title = 'Title is required.';
  if (!form.state.trim()) errors.state = 'State is required.';
  if (!form.city.trim()) errors.city = 'City is required.';
  if (!form.type.trim()) errors.type = 'Type is required.';
  if (!form.company.trim()) errors.company = 'Company is required.';
  if (!form.description.trim()) errors.description = 'Description is required.';
  return errors;
}

function fromJob(job: Job): FormState {
  return {
    title: job.title,
    state: job.state,
    city: job.city,
    type: job.type,
    company: job.company,
    description: job.description,
  };
}

function trimAll(form: FormState): FormState {
  return {
    title: form.title.trim(),
    state: form.state.trim(),
    city: form.city.trim(),
    type: form.type.trim(),
    company: form.company.trim(),
    description: form.description.trim(),
  };
}

function formatPostedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function PostingForm({
  mode,
  onCancel,
  onSaved,
}: {
  mode: { kind: 'create' } | { kind: 'edit'; job: Job };
  onCancel: () => void;
  onSaved: (job: Job, action: 'created' | 'updated') => void;
}) {
  const isEdit = mode.kind === 'edit';
  const [form, setForm] = useState<FormState>(isEdit ? fromJob(mode.job) : EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const payload = trimAll(form);
      if (isEdit) {
        const res = await api.patch<{ post: Job }>(`/api/employer/post/${mode.job.id}`, payload);
        onSaved(res.post, 'updated');
      } else {
        const res = await api.post<{ post: Job }>('/api/employer/post', payload);
        onSaved(res.post, 'created');
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.body &&
        typeof err.body === 'object' &&
        'issues' in err.body
      ) {
        const issues = (
          err.body as { issues: Array<{ path: Array<string | number>; message: string }> }
        ).issues;
        const fe: FormErrors = {};
        for (const issue of issues) {
          const field = issue.path[0];
          if (typeof field === 'string' && field in EMPTY_FORM) {
            fe[field as keyof FormState] = issue.message;
          }
        }
        if (Object.keys(fe).length > 0) setErrors(fe);
        else setGeneralError(err.message);
      } else if (err instanceof ApiError) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="posting-form-heading"
      className="space-y-4 rounded-xl border border-brand-100 bg-surface p-5"
    >
      <h2 id="posting-form-heading" className="text-lg font-semibold text-ink">
        {isEdit ? `Edit posting: ${mode.job.title}` : 'New job posting'}
      </h2>

      {generalError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {generalError}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Job title"
          required
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          error={errors.title}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="State"
            required
            value={form.state}
            onChange={(e) => update('state', e.target.value)}
            error={errors.state}
            helperText="e.g. CA"
          />
          <Input
            label="City"
            required
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            error={errors.city}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Type"
            required
            placeholder="Select one"
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
            options={TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
            error={errors.type}
          />
          <Input
            label="Company"
            required
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
            error={errors.company}
          />
        </div>
        <Textarea
          label="Description"
          required
          rows={6}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          error={errors.description}
        />

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting} disabled={submitting}>
            {submitting
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create posting'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function AdminJobsPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadError, setLoadError] = useState<string>('');
  const [mode, setMode] = useState<FormMode>({ kind: 'closed' });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<JobsResponse>('/api/jobs?pageSize=100', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setJobs(data.items);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(
          err instanceof ApiError ? `${err.message} (${err.status})` : 'Unexpected error.',
        );
        setStatus('error');
      });
    return () => controller.abort();
  }, [reloadKey]);

  function handleSaved(job: Job, action: 'created' | 'updated') {
    setMode({ kind: 'closed' });
    setBanner({
      kind: 'success',
      message: action === 'created' ? `Created "${job.title}".` : `Updated "${job.title}".`,
    });
    if (action === 'created') {
      setJobs((prev) => [job, ...prev]);
    } else {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
    }
  }

  async function handleConfirmDelete(job: Job) {
    setDeleting(true);
    setBanner(null);
    try {
      await api.post('/api/employer/delete', { id: job.id });
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      setBanner({ kind: 'success', message: `Deleted "${job.title}".` });
      setPendingDeleteId(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setBanner({ kind: 'error', message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="admin-jobs-heading" className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Admin</p>
          <h1 id="admin-jobs-heading" className="text-3xl font-bold text-brand-900 md:text-4xl">
            Manage Job Postings
          </h1>
        </div>
        {mode.kind === 'closed' && (
          <Button onClick={() => setMode({ kind: 'create' })}>New posting</Button>
        )}
      </div>

      {banner && (
        <div
          role="status"
          className={
            banner.kind === 'success'
              ? 'rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {banner.message}
        </div>
      )}

      {mode.kind !== 'closed' && (
        <PostingForm
          mode={mode}
          onCancel={() => setMode({ kind: 'closed' })}
          onSaved={handleSaved}
        />
      )}

      {status === 'loading' && (
        <p role="status" className="text-sm text-ink-muted">
          Loading postings…
        </p>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p>We couldn’t load the postings: {loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </Button>
        </div>
      )}

      {status === 'ready' && jobs.length === 0 && (
        <p className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-6 text-center text-sm text-ink-muted">
          No postings yet. Use “New posting” to create the first one.
        </p>
      )}

      {status === 'ready' && jobs.length > 0 && (
        <ul aria-label="Job postings" className="space-y-3">
          {jobs.map((job) => {
            const isConfirming = pendingDeleteId === job.id;
            return (
              <li
                key={job.id}
                className="rounded-xl border border-brand-100 bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-semibold text-brand-900">{job.title}</h3>
                    <p className="text-xs text-ink-muted">
                      {job.city}, {job.state} &middot; {job.type} &middot; {job.company} &middot;
                      Posted{' '}
                      <time dateTime={job.postedDate}>{formatPostedDate(job.postedDate)}</time>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setBanner(null);
                        setPendingDeleteId(null);
                        setMode({ kind: 'edit', job });
                      }}
                      disabled={mode.kind !== 'closed'}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setBanner(null);
                        setPendingDeleteId(job.id);
                      }}
                      disabled={mode.kind !== 'closed' || (deleting && pendingDeleteId !== job.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {isConfirming && (
                  <div className="mt-3 space-y-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <p className="font-medium">Delete this posting? This can’t be undone.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleConfirmDelete(job)}
                        isLoading={deleting}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPendingDeleteId(null)}
                        disabled={deleting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default AdminJobsPage;
