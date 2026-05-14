import { createApp } from './app.js';
import { parseDurationToSeconds } from './auth/duration.js';
import { createMailer, type SmtpConfig } from './mail/mailer.js';

const port = Number(process.env.PORT) || 3001;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
if (!jwtAccessSecret || !jwtRefreshSecret) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set.');
}

const isProduction = process.env.NODE_ENV === 'production';

function resolveSmtp(): SmtpConfig {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    return {
      kind: 'smtp',
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user,
      pass,
    };
  }
  // No SMTP creds: use Ethereal in dev (real-looking preview URLs), fall
  // back to a log-only mailer in prod-without-SMTP so nothing crashes.
  return isProduction ? { kind: 'log' } : { kind: 'ethereal' };
}

const mailer = await createMailer({
  fromAddress: process.env.MAIL_FROM ?? 'Entractus Recruitment <no-reply@entractus.local>',
  smtp: resolveSmtp(),
});

const app = createApp({
  webOrigin,
  auth: {
    jwtAccessSecret,
    jwtRefreshSecret,
    accessTokenTtlSeconds: parseDurationToSeconds(process.env.JWT_ACCESS_TTL ?? '15m'),
    refreshTokenTtlSeconds: parseDurationToSeconds(process.env.JWT_REFRESH_TTL ?? '7d'),
    passwordResetTtlSeconds: parseDurationToSeconds(process.env.PASSWORD_RESET_TTL ?? '1h'),
    isProduction,
    mailer,
    webBaseUrl: process.env.WEB_BASE_URL ?? webOrigin,
  },
});

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
