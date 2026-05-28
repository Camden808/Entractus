import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import Button from '../components/Button';
import Input from '../components/Input';
import { api, ApiError } from '../lib/apiClient';
import { useAuth, type User } from '../lib/auth';

type ProfileBanner =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null;

function ProfileSummary({ user }: { user: User }) {
  const created = new Date(user.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? user.createdAt
    : created.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">Email</dt>
        <dd className="text-sm text-ink">{user.email}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          Display name
        </dt>
        <dd className="text-sm text-ink">
          {user.displayName ?? <span className="text-ink-muted">—</span>}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">Timezone</dt>
        <dd className="text-sm text-ink">{user.timezone}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">Company</dt>
        <dd className="text-sm text-ink">
          {user.company ?? <span className="text-ink-muted">—</span>}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">Role</dt>
        <dd className="text-sm text-ink capitalize">{user.role}</dd>
      </div>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          Member since
        </dt>
        <dd className="text-sm text-ink">{createdLabel}</dd>
      </div>
    </dl>
  );
}

function ProfileEditForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [timezone, setTimezone] = useState(user.timezone);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<ProfileBanner>(null);

  const dirty =
    (displayName.trim() || null) !== (user.displayName ?? null) || timezone !== user.timezone;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    setSubmitting(true);
    try {
      const trimmed = displayName.trim();
      const payload: { displayName?: string; timezone?: string } = {};
      if (trimmed !== (user.displayName ?? '')) payload.displayName = trimmed;
      if (timezone !== user.timezone) payload.timezone = timezone;
      const res = await api.patch<{ user: User }>('/api/users/me', payload);
      setUser(res.user);
      setBanner({ kind: 'success', message: 'Profile updated.' });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setBanner({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Edit profile</h2>
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
      <Input
        label="Display name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        autoComplete="name"
        helperText="How we’ll address you."
      />
      <Input
        label="Timezone"
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        helperText="IANA timezone identifier, e.g. America/Los_Angeles."
      />
      <div className="flex justify-end">
        <Button type="submit" isLoading={submitting} disabled={submitting || !dirty}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function ChangePasswordSection({ user }: { user: User }) {
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<ProfileBanner>(null);

  async function handleSend() {
    setBanner(null);
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: user.email });
      setBanner({
        kind: 'success',
        message: 'Sent. Check your inbox for a password-reset link.',
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setBanner({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="change-pw-heading" className="space-y-3">
      <h2 id="change-pw-heading" className="text-lg font-semibold text-ink">
        Change password
      </h2>
      <p className="text-sm text-ink-muted">
        We&rsquo;ll email <span className="font-medium text-ink">{user.email}</span> a
        password-reset link. Use it to set a new password.
      </p>
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
      <div>
        <Button
          variant="secondary"
          onClick={() => void handleSend()}
          isLoading={submitting}
          disabled={submitting}
        >
          {submitting ? 'Sending…' : 'Send password-reset email'}
        </Button>
      </div>
    </section>
  );
}

function DeleteAccountSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setError(null);
    setSubmitting(true);
    try {
      await api.delete('/api/users/me');
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="delete-heading"
      className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5"
    >
      <h2 id="delete-heading" className="text-lg font-semibold text-red-800">
        Delete account
      </h2>
      <p className="text-sm text-red-700">
        Permanently delete your account and all data we hold for it. This can&rsquo;t be undone.
      </p>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-white px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {confirming ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-red-800">
            Are you sure? This will remove your profile, job postings, and other owned data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              isLoading={submitting}
              disabled={submitting}
            >
              {submitting ? 'Deleting…' : 'Yes, delete my account'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            Delete my account
          </Button>
        </div>
      )}
    </section>
  );
}

function AccountPage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      navigate('/login', { replace: true });
    }
  }, [state.status, navigate]);

  if (state.status === 'loading') {
    return (
      <section aria-labelledby="account-heading" className="mx-auto max-w-3xl space-y-4">
        <h1 id="account-heading" className="text-3xl font-bold text-brand-900">
          Your Account
        </h1>
        <p role="status" className="text-sm text-ink-muted">
          Loading your account…
        </p>
      </section>
    );
  }

  if (state.status === 'unauthenticated') {
    return null;
  }

  const user = state.user;

  return (
    <section aria-labelledby="account-heading" className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Account</p>
        <h1 id="account-heading" className="text-3xl font-bold text-brand-900 md:text-4xl">
          Your Account
        </h1>
      </div>

      <section
        aria-labelledby="profile-heading"
        className="space-y-4 rounded-xl border border-brand-100 bg-surface p-5"
      >
        <h2 id="profile-heading" className="text-lg font-semibold text-ink">
          Profile
        </h2>
        <ProfileSummary user={user} />
      </section>

      <section className="space-y-4 rounded-xl border border-brand-100 bg-surface p-5">
        <ProfileEditForm user={user} />
      </section>

      <section className="space-y-4 rounded-xl border border-brand-100 bg-surface p-5">
        <ChangePasswordSection user={user} />
      </section>

      <DeleteAccountSection />
    </section>
  );
}

export default AccountPage;
