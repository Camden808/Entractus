import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import Button from '../components/Button';
import Input from '../components/Input';
import { ApiError } from '../lib/apiClient';
import { useAuth } from '../lib/auth';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PASSWORD_MIN = 8;

type FormErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  displayName?: string;
  company?: string;
};

function RegisterPage() {
  const { state, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (state.status === 'authenticated') {
      navigate('/account', { replace: true });
    }
  }, [state.status, navigate]);

  function validate(): boolean {
    const next: FormErrors = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    else if (password.length < PASSWORD_MIN)
      next.password = `Password must be at least ${PASSWORD_MIN} characters.`;
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password.';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords don’t match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(key: keyof FormErrors) {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        company: company.trim() || undefined,
      });
      navigate('/account', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors((prev) => ({
          ...prev,
          email: 'An account with that email already exists.',
        }));
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.body &&
        typeof err.body === 'object' &&
        'issues' in err.body
      ) {
        const issues = (
          err.body as { issues: Array<{ path: Array<string | number>; message: string }> }
        ).issues;
        const fieldErrors: FormErrors = {};
        const knownFields = ['email', 'password', 'displayName', 'company'] as const;
        type KnownField = (typeof knownFields)[number];
        for (const issue of issues) {
          const field = issue.path[0];
          if (typeof field === 'string' && (knownFields as ReadonlyArray<string>).includes(field)) {
            fieldErrors[field as KnownField] = issue.message;
          }
        }
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setGeneralError(err.message);
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article aria-labelledby="register-heading" className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 id="register-heading" className="text-3xl font-bold text-brand-900">
          Create an Account
        </h1>
        <p className="text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Log in
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
            clearError('email');
          }}
          error={errors.email}
        />
        <Input
          label="Display name"
          autoComplete="name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            clearError('displayName');
          }}
          error={errors.displayName}
          helperText="Optional. How we’ll address you."
        />
        <Input
          label="Company"
          autoComplete="organization"
          value={company}
          onChange={(e) => {
            setCompany(e.target.value);
            clearError('company');
          }}
          error={errors.company}
          helperText="Optional."
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError('password');
          }}
          error={errors.password}
          helperText={`At least ${PASSWORD_MIN} characters.`}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearError('confirmPassword');
          }}
          error={errors.confirmPassword}
        />

        <Button type="submit" className="w-full" isLoading={submitting} disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </article>
  );
}

export default RegisterPage;
