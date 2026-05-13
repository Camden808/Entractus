import { createApp } from './app.js';
import { parseDurationToSeconds } from './auth/duration.js';

const port = Number(process.env.PORT) || 3001;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
if (!jwtAccessSecret || !jwtRefreshSecret) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set.');
}

const app = createApp({
  webOrigin,
  auth: {
    jwtAccessSecret,
    jwtRefreshSecret,
    accessTokenTtlSeconds: parseDurationToSeconds(process.env.JWT_ACCESS_TTL ?? '15m'),
    refreshTokenTtlSeconds: parseDurationToSeconds(process.env.JWT_REFRESH_TTL ?? '7d'),
    isProduction: process.env.NODE_ENV === 'production',
  },
});

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
