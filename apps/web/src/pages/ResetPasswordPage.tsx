import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import Button from '../components/Button';
import Input from '../components/Input';
import { api, ApiError } from '../lib/apiClient';

const PASSWORD_MIN = 8;

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <article
        aria-labelledby="reset-invalid-heading"
        className="mx-auto max-w-md space-y-4 rounded-xl border border-red-200 bg-red-50 p-8 text-center"
      >
        <h1 id="reset-invalid-heading" className="text-2xl font-bold text-red-800">
          Reset link is missing or invalid
        </h1>
        <p className="text-sm text-red-700">
          Your reset link doesn&rsquo;t include a token. Request a new one from the forgot-password
          page.
        </p>
        <div>
          <Link
            to="/forgot-password"
            className="inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Get a new link
          </Link>
        </div>
      </article>
    );
  }

  function validate(): boolean {
    const next: { password?: string; confirmPassword?: string } = {};
    if (!password) next.password = 'Password is required.';
    else if (password.length < PASSWORD_MIN)
      next.password = `Password must be at least ${PASSWORD_MIN} characters.`;
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password.';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords don’t match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, password }, { skipAuthRefresh: true });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setGeneralError(
          'This reset link is no longer valid. Request a new one from the forgot-password page.',
        );
      } else if (err instanceof ApiError) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <article
        aria-labelledby="reset-done-heading"
        className="mx-auto max-w-md space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center"
      >
        <h1 id="reset-done-heading" className="text-2xl font-bold text-emerald-800">
          Password updated
        </h1>
        <p className="text-sm text-emerald-900">
          Your password has been reset. You can now sign in with the new password.
        </p>
        <div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Go to log in
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article aria-labelledby="reset-heading" className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 id="reset-heading" className="text-3xl font-bold text-brand-900">
          Reset Your Password
        </h1>
        <p className="text-sm text-ink-muted">Choose a new password for your account.</p>
      </div>

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
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          error={errors.password}
          helperText={`At least ${PASSWORD_MIN} characters.`}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (errors.confirmPassword)
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          error={errors.confirmPassword}
        />

        <Button type="submit" className="w-full" isLoading={submitting} disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </article>
  );
}

export default ResetPasswordPage;
