import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';

const { uploadMock, MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  }
  return { uploadMock: vi.fn(), MockApiError };
});

vi.mock('../lib/apiClient', () => ({
  api: { upload: uploadMock },
  ApiError: MockApiError,
}));

import ContactPage from './ContactPage';

beforeEach(() => {
  uploadMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), 'Jane');
  await user.type(screen.getByLabelText(/last name/i), 'Doe');
  await user.type(screen.getByLabelText(/company name/i), 'BuildCo');
  await user.type(screen.getByLabelText(/company address/i), '100 Main St');
  await user.type(screen.getByLabelText(/^phone$/i), '555-010-2024');
  await user.type(screen.getByLabelText(/^email$/i), 'jane@buildco.com');
}

describe('<ContactPage /> — fields', () => {
  it('renders every field from the Requirements.md spec', () => {
    render(<ContactPage />);
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^phone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/position title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/position type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hours/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/position duties/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/attach a job description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/additional questions regarding hiring/i)).toBeInTheDocument();
  });

  it('offers the three Position Type values and two Hours values', () => {
    render(<ContactPage />);
    const positionType = screen.getByLabelText(/position type/i);
    expect(within(positionType).getByRole('option', { name: 'Temporary' })).toBeInTheDocument();
    expect(within(positionType).getByRole('option', { name: 'Temp To Perm' })).toBeInTheDocument();
    expect(within(positionType).getByRole('option', { name: 'Direct Hire' })).toBeInTheDocument();
    const hours = screen.getByLabelText(/hours/i);
    expect(within(hours).getByRole('option', { name: 'Full Time' })).toBeInTheDocument();
    expect(within(hours).getByRole('option', { name: 'Part Time' })).toBeInTheDocument();
  });
});

describe('<ContactPage /> — client validation', () => {
  it('blocks submission and shows required errors when fields are empty', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(uploadMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/correct the highlighted fields/i);
    expect(screen.getByLabelText(/first name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await fillRequiredFields(user);
    await user.clear(screen.getByLabelText(/^email$/i));
    await user.type(screen.getByLabelText(/^email$/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(uploadMock).not.toHaveBeenCalled();
    const email = screen.getByLabelText(/^email$/i);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    const messageId = email.getAttribute('aria-describedby')!;
    expect(document.getElementById(messageId)).toHaveTextContent(/valid email/i);
  });

  it('clears a field error as soon as the user edits the field', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);
    await user.click(screen.getByRole('button', { name: /send request/i }));
    expect(screen.getByLabelText(/first name/i)).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByLabelText(/first name/i), 'J');
    expect(screen.getByLabelText(/first name/i)).not.toHaveAttribute('aria-invalid');
  });
});

describe('<ContactPage /> — submit', () => {
  it('POSTs FormData with required + optional fields and the attached file, then shows a success message', async () => {
    uploadMock.mockResolvedValueOnce({ requestId: 'req-123' });
    const user = userEvent.setup();
    render(<ContactPage />);
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/position title/i), 'Site Engineer');
    await user.selectOptions(screen.getByLabelText(/position type/i), 'Direct Hire');
    await user.selectOptions(screen.getByLabelText(/hours/i), 'Full Time');
    await user.type(screen.getByLabelText(/position duties/i), 'Run the site.');
    await user.upload(
      screen.getByLabelText(/attach a job description/i),
      new File(['fake'], 'jd.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path, body] = uploadMock.mock.calls[0]!;
    expect(path).toBe('/api/employer/request');
    expect(body).toBeInstanceOf(FormData);
    const fd = body as FormData;
    expect(fd.get('firstName')).toBe('Jane');
    expect(fd.get('lastName')).toBe('Doe');
    expect(fd.get('company')).toBe('BuildCo');
    expect(fd.get('addressLine1')).toBe('100 Main St');
    expect(fd.get('phone')).toBe('555-010-2024');
    expect(fd.get('email')).toBe('jane@buildco.com');
    expect(fd.get('positionTitle')).toBe('Site Engineer');
    expect(fd.get('positionType')).toBe('Direct Hire');
    expect(fd.get('hours')).toBe('Full Time');
    expect(fd.get('duties')).toBe('Run the site.');
    expect(fd.get('jobDescription')).toBeInstanceOf(File);
    expect((fd.get('jobDescription') as File).name).toBe('jd.pdf');

    expect(await screen.findByRole('heading', { level: 1, name: /thanks/i })).toBeInTheDocument();
    expect(screen.getByText(/req-123/)).toBeInTheDocument();
  });

  it('omits empty optional fields from the FormData payload', async () => {
    uploadMock.mockResolvedValueOnce({ requestId: 'req-1' });
    const user = userEvent.setup();
    render(<ContactPage />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    const fd = uploadMock.mock.calls[0]![1] as FormData;
    expect(fd.has('city')).toBe(false);
    expect(fd.has('positionTitle')).toBe(false);
    expect(fd.has('positionType')).toBe(false);
    expect(fd.has('hours')).toBe(false);
    expect(fd.has('duties')).toBe(false);
    expect(fd.has('questions')).toBe(false);
    expect(fd.has('jobDescription')).toBe(false);
  });

  it('maps a 400 ApiError with issues onto per-field errors', async () => {
    uploadMock.mockRejectedValueOnce(
      new MockApiError(400, 'invalid_request', {
        error: 'invalid_request',
        issues: [
          { path: ['phone'], message: 'Phone too short' },
          { path: ['email'], message: 'Invalid email address' },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<ContactPage />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByText(/phone too short/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/correct the highlighted fields/i);
  });

  it('shows a generic error message for non-400 / network failures', async () => {
    uploadMock.mockRejectedValueOnce(new Error('Network down'));
    const user = userEvent.setup();
    render(<ContactPage />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByRole('heading', { level: 1, name: /thanks/i })).not.toBeInTheDocument();
  });

  it('allows submitting another request from the success screen', async () => {
    uploadMock.mockResolvedValueOnce({ requestId: 'req-1' });
    const user = userEvent.setup();
    render(<ContactPage />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send request/i }));

    await user.click(await screen.findByRole('button', { name: /submit another request/i }));
    expect(screen.getByRole('heading', { level: 1, name: /^contact us$/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/first name/i) as HTMLInputElement).value).toBe('');
  });
});
