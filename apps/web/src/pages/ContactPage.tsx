import { useState, type FormEvent } from 'react';
import Button from '../components/Button';
import FileDropzone from '../components/FileDropzone';
import Input from '../components/Input';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import { ApiError, api } from '../lib/apiClient';

type StringField =
  | 'firstName'
  | 'lastName'
  | 'company'
  | 'addressLine1'
  | 'city'
  | 'phone'
  | 'email'
  | 'positionTitle'
  | 'positionType'
  | 'hours'
  | 'duties'
  | 'questions';

type FormState = Record<StringField, string> & { jobDescription: File[] };

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  company: '',
  addressLine1: '',
  city: '',
  phone: '',
  email: '',
  positionTitle: '',
  positionType: '',
  hours: '',
  duties: '',
  questions: '',
  jobDescription: [],
};

const POSITION_TYPES = [
  { value: 'Temporary', label: 'Temporary' },
  { value: 'Temp To Perm', label: 'Temp To Perm' },
  { value: 'Direct Hire', label: 'Direct Hire' },
] as const;

const HOURS_OPTIONS = [
  { value: 'Full Time', label: 'Full Time' },
  { value: 'Part Time', label: 'Part Time' },
] as const;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(form: FormState): Partial<Record<StringField, string>> {
  const errors: Partial<Record<StringField, string>> = {};
  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!form.company.trim()) errors.company = 'Company name is required.';
  if (!form.addressLine1.trim()) errors.addressLine1 = 'Address is required.';
  if (!form.phone.trim()) errors.phone = 'Phone is required.';
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  return errors;
}

type SubmitResult = { requestId: string };

function ContactPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<StringField, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SubmitResult | null>(null);

  function update<K extends StringField>(key: K, value: string) {
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
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setGeneralError('Please correct the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setErrors({});
    setGeneralError(null);

    try {
      const fd = new FormData();
      const stringKeys: StringField[] = [
        'firstName',
        'lastName',
        'company',
        'addressLine1',
        'city',
        'phone',
        'email',
        'positionTitle',
        'positionType',
        'hours',
        'duties',
        'questions',
      ];
      for (const key of stringKeys) {
        const value = form[key].trim();
        if (value) fd.append(key, value);
      }
      if (form.jobDescription[0]) {
        fd.append('jobDescription', form.jobDescription[0]);
      }
      const result = await api.upload<SubmitResult>('/api/employer/request', fd);
      setSuccess(result);
      setForm(INITIAL);
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
        const fieldErrors: Partial<Record<StringField, string>> = {};
        for (const issue of issues) {
          const field = issue.path[0];
          if (typeof field === 'string' && field in INITIAL && field !== 'jobDescription') {
            fieldErrors[field as StringField] = issue.message;
          }
        }
        setErrors(fieldErrors);
        setGeneralError('Please correct the highlighted fields.');
      } else {
        setGeneralError('Something went wrong submitting your request. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSuccess(null);
    setGeneralError(null);
    setErrors({});
  }

  if (success) {
    return (
      <article
        aria-labelledby="contact-success-heading"
        className="mx-auto max-w-2xl space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center"
      >
        <h1 id="contact-success-heading" className="text-2xl font-bold text-emerald-800">
          Thanks &mdash; we&rsquo;ll be in touch.
        </h1>
        <p className="text-emerald-900">
          Your request has been received. Someone from the Entractus Recruitment team will reach out
          soon.
        </p>
        <p className="text-xs text-emerald-700">
          Reference ID: <code>{success.requestId}</code>
        </p>
        <div>
          <Button variant="secondary" onClick={handleReset}>
            Submit another request
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article aria-labelledby="contact-heading" className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Employers</p>
        <h1 id="contact-heading" className="text-3xl font-bold text-brand-900 md:text-4xl">
          Contact Us
        </h1>
        <p className="text-base text-ink-muted">
          If you are hiring, please complete the form below and someone from the Entractus
          Recruitment team will be in touch.
        </p>
      </header>

      {generalError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {generalError}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} className="space-y-8">
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-ink">Company information</legend>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="First name"
              required
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              error={errors.firstName}
              autoComplete="given-name"
            />
            <Input
              label="Last name"
              required
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              error={errors.lastName}
              autoComplete="family-name"
            />
          </div>

          <Input
            label="Company name"
            required
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
            error={errors.company}
            autoComplete="organization"
          />

          <Input
            label="Company address"
            required
            value={form.addressLine1}
            onChange={(e) => update('addressLine1', e.target.value)}
            error={errors.addressLine1}
            autoComplete="street-address"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="City"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              error={errors.city}
              autoComplete="address-level2"
            />
            <Input
              label="Phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              error={errors.phone}
              autoComplete="tel"
            />
          </div>

          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            error={errors.email}
            autoComplete="email"
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold text-ink">
            What position(s) are you hiring for?
          </legend>

          <Input
            label="Position title"
            value={form.positionTitle}
            onChange={(e) => update('positionTitle', e.target.value)}
            error={errors.positionTitle}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Position type"
              options={POSITION_TYPES}
              placeholder="Select one"
              value={form.positionType}
              onChange={(e) => update('positionType', e.target.value)}
              error={errors.positionType}
            />
            <Select
              label="Hours"
              options={HOURS_OPTIONS}
              placeholder="Select one"
              value={form.hours}
              onChange={(e) => update('hours', e.target.value)}
              error={errors.hours}
            />
          </div>

          <Textarea
            label="Position duties & responsibilities"
            rows={5}
            value={form.duties}
            onChange={(e) => update('duties', e.target.value)}
            error={errors.duties}
          />

          <FileDropzone
            label="Attach a job description (optional)"
            accept=".pdf,.doc,.docx,application/pdf"
            value={form.jobDescription}
            onChange={(files) => setForm((prev) => ({ ...prev, jobDescription: files }))}
            helperText="PDF, DOC, or DOCX up to 5 MB."
          />
        </fieldset>

        <Textarea
          label="Do you have any additional questions regarding hiring talent through Entractus Recruitment?"
          rows={4}
          value={form.questions}
          onChange={(e) => update('questions', e.target.value)}
          error={errors.questions}
        />

        <div className="flex justify-end">
          <Button type="submit" size="lg" isLoading={submitting} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </form>
    </article>
  );
}

export default ContactPage;
