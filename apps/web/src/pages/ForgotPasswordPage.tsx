import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import Button from '../components/Button';
import Input from '../components/Input';
import { api, ApiError } from '../lib/apiClient';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: trimmed }, { skipAuthRefresh: true });
      setSubmitted(true);
    } catch (err) {
      setGeneralError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <article
        aria-labelledby="forgot-success-heading"
        className="mx-auto max-w-md space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center"
      >
        <h1 id="forgot-success-heading" className="text-2xl font-bold text-emerald-800">
          Check your email
        </h1>
        <p className="text-sm text-emerald-900">
          If an account with that email exists, we&rsquo;ve sent a password-reset link. The link
          expires in about an hour.
        </p>
        <p className="text-xs text-emerald-700">
          Didn&rsquo;t get it? Double-check the address and try again.
        </p>
        <div>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            Back to log in
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article aria-labelledby="forgot-heading" className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 id="forgot-heading" className="text-3xl font-bold text-brand-900">
          Forgot Your Password?
        </h1>
        <p className="text-sm text-ink-muted">
          Enter the email on your account and we&rsquo;ll send a reset link.
        </p>
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
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(undefined);
          }}
          error={emailError}
        />
        <Button type="submit" className="w-full" isLoading={submitting} disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-muted">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Back to log in
        </Link>
        .
      </p>
    </article>
  );
}

export default ForgotPasswordPage;
