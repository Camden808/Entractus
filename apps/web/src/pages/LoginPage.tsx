import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import Button from '../components/Button';
import Input from '../components/Input';
import { ApiError } from '../lib/apiClient';
import { useAuth } from '../lib/auth';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If we land on /login while already authenticated, bounce to the account
  // portal so users don't see a stale login form.
  useEffect(() => {
    if (state.status === 'authenticated') {
      navigate('/account', { replace: true });
    }
  }, [state.status, navigate]);

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/account', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setGeneralError('That email and password don’t match an account.');
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
    <article aria-labelledby="login-heading" className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 id="login-heading" className="text-3xl font-bold text-brand-900">
          Log In
        </h1>
        <p className="text-sm text-ink-muted">
          Don&rsquo;t have an account?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
            Create one
          </Link>
          .
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
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          error={errors.password}
        />

        <Button type="submit" className="w-full" isLoading={submitting} disabled={submitting}>
          {submitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-muted">
        <Link to="/forgot-password" className="font-medium text-brand-700 hover:text-brand-800">
          Forgot your password?
        </Link>
      </p>
    </article>
  );
}

export default LoginPage;
