import nodemailer, { type Transporter } from 'nodemailer';

export interface PasswordResetEmail {
  to: string;
  resetUrl: string;
  ttlMinutes: number;
}

/** Every field captured by the employer Contact form (Tasks.md §4). */
export interface EmployerRequestData {
  firstName: string;
  lastName: string;
  company: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  phone: string;
  email: string;
  positionName?: string | null;
  positionTitle?: string | null;
  positionType?: string | null;
  hours?: string | null;
  duties?: string | null;
  referralSource?: string | null;
  questions?: string | null;
  jobDescriptionFilename?: string | null;
}

export interface EmployerRequestEmail {
  to: string;
  /** Submitter's email — set as reply-to so staff can reply directly. */
  replyTo?: string;
  request: EmployerRequestData;
  /** Uploaded job description, attached when present (path on disk or in-memory buffer). */
  jobDescription?: { filename: string; path?: string; content?: Buffer } | null;
}

export interface Mailer {
  sendPasswordReset(opts: PasswordResetEmail): Promise<void>;
  sendEmployerRequest(opts: EmployerRequestEmail): Promise<void>;
}

export type SmtpConfig =
  | { kind: 'ethereal' } // dev: Nodemailer auto-creates a test account
  | {
      kind: 'smtp';
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    }
  | { kind: 'log' }; // fallback / tests: just log the URL, never sends

export interface MailerOptions {
  fromAddress: string;
  smtp: SmtpConfig;
}

const EMPTY = '—';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ordered [label, value] rows for the single-line fields. */
function fieldRows(r: EmployerRequestData): [string, string][] {
  const v = (value?: string | null) => (value && value.trim() ? value.trim() : EMPTY);
  return [
    ['Contact name', v(`${r.firstName} ${r.lastName}`)],
    ['Company', v(r.company)],
    ['Address line 1', v(r.addressLine1)],
    ['Address line 2', v(r.addressLine2)],
    ['City', v(r.city)],
    ['State', v(r.state)],
    ['Phone', v(r.phone)],
    ['Email', v(r.email)],
    ['Position name', v(r.positionName)],
    ['Position title', v(r.positionTitle)],
    ['Position type', v(r.positionType)],
    ['Hours', v(r.hours)],
    ['Referral source', v(r.referralSource)],
    ['Job description file', v(r.jobDescriptionFilename)],
  ];
}

function renderEmployerRequestText(r: EmployerRequestData): string {
  const v = (value?: string | null) => (value && value.trim() ? value.trim() : EMPTY);
  const lines = ['New employer recruitment request', ''];
  for (const [label, value] of fieldRows(r)) {
    lines.push(`${label}: ${value}`);
  }
  lines.push('', 'Duties & responsibilities:', v(r.duties));
  lines.push('', 'Additional questions:', v(r.questions));
  return lines.join('\n');
}

function renderEmployerRequestHtml(r: EmployerRequestData): string {
  const v = (value?: string | null) => escapeHtml(value && value.trim() ? value.trim() : EMPTY);
  const rows = fieldRows(r)
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:4px 12px 4px 0;vertical-align:top">${escapeHtml(
          label,
        )}</th><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<h2>New employer recruitment request</h2>
<table style="border-collapse:collapse">${rows}</table>
<h3>Duties &amp; responsibilities</h3>
<p>${v(r.duties)}</p>
<h3>Additional questions</h3>
<p>${v(r.questions)}</p>`;
}

export async function createMailer({ fromAddress, smtp }: MailerOptions): Promise<Mailer> {
  if (smtp.kind === 'log') {
    return {
      sendPasswordReset: async ({ to, resetUrl }) => {
        console.log(`[mailer:log] would send password reset to ${to}: ${resetUrl}`);
      },
      sendEmployerRequest: async ({ to, request }) => {
        console.log(
          `[mailer:log] would send employer request notification to ${to} from ${request.email}`,
        );
      },
    };
  }

  let transporter: Transporter;
  if (smtp.kind === 'ethereal') {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log(
      `[mailer:ethereal] created test account ${testAccount.user} — preview URLs are logged on each send`,
    );
  } else {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
  }

  return {
    sendPasswordReset: async ({ to, resetUrl, ttlMinutes }) => {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject: 'Reset your Entractus password',
        text: `We received a request to reset your password.

Click this link to set a new password (expires in ${ttlMinutes} minutes):
${resetUrl}

If you didn't request this, you can safely ignore this email.`,
        html: `<p>We received a request to reset your password.</p>
<p><a href="${resetUrl}">Click here</a> to set a new password.</p>
<p>This link expires in ${ttlMinutes} minutes.</p>
<p>If you didn't request this, you can safely ignore this email.</p>`,
      });

      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) {
        console.log(`[mailer:ethereal] preview: ${preview}`);
      }
    },

    sendEmployerRequest: async ({ to, replyTo, request, jobDescription }) => {
      const attachments =
        jobDescription && (jobDescription.path || jobDescription.content)
          ? [
              {
                filename: jobDescription.filename,
                ...(jobDescription.path
                  ? { path: jobDescription.path }
                  : { content: jobDescription.content }),
              },
            ]
          : undefined;

      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        replyTo,
        subject: `New recruitment request — ${request.company}`,
        text: renderEmployerRequestText(request),
        html: renderEmployerRequestHtml(request),
        attachments,
      });

      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) {
        console.log(`[mailer:ethereal] preview: ${preview}`);
      }
    },
  };
}
