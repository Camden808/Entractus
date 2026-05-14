import nodemailer, { type Transporter } from 'nodemailer';

export interface PasswordResetEmail {
  to: string;
  resetUrl: string;
  ttlMinutes: number;
}

export interface Mailer {
  sendPasswordReset(opts: PasswordResetEmail): Promise<void>;
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

export async function createMailer({ fromAddress, smtp }: MailerOptions): Promise<Mailer> {
  if (smtp.kind === 'log') {
    return {
      sendPasswordReset: async ({ to, resetUrl }) => {
        console.log(`[mailer:log] would send password reset to ${to}: ${resetUrl}`);
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
  };
}
