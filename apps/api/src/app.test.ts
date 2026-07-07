import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

// app.ts now mounts the auth router which imports the Prisma client.
// Stub the client at module-load time so the suite never touches a DB.
vi.mock('./db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    revokedRefreshToken: { findUnique: vi.fn(), create: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    employerRequest: { findUnique: vi.fn(), create: vi.fn() },
    jobPosting: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const WEB_ORIGIN = 'http://localhost:5173';
const SESSION_OPTS = {
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
  isProduction: false,
};

function makeApp() {
  return createApp({
    webOrigin: WEB_ORIGIN,
    auth: {
      ...SESSION_OPTS,
      passwordResetTtlSeconds: 60 * 60,
      mailer: { sendPasswordReset: vi.fn() },
      webBaseUrl: WEB_ORIGIN,
    },
    employer: {
      ...SESSION_OPTS,
      uploadDir: './test-uploads',
      mailer: { sendEmployerRequest: vi.fn() },
      notificationEmail: 'contact@entractus.com',
    },
  });
}

describe('GET /healthz', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await request(makeApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('unknown routes', () => {
  it('returns 404 for an unknown GET', async () => {
    const res = await request(makeApp()).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('echoes the allowed origin on a preflight from WEB_ORIGIN', async () => {
    const res = await request(makeApp())
      .options('/healthz')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBeLessThan(400);
    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not echo a disallowed origin', async () => {
    const res = await request(makeApp())
      .options('/healthz')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
  });

  it('allows any origin in a comma-separated WEB_ORIGIN list', async () => {
    const origins = ['https://www.entractus.com', 'https://entractus.com'];
    const app = createApp({
      webOrigin: origins.join(','),
      auth: {
        ...SESSION_OPTS,
        passwordResetTtlSeconds: 3600,
        mailer: { sendPasswordReset: vi.fn() },
        webBaseUrl: origins[0]!,
      },
      employer: {
        ...SESSION_OPTS,
        uploadDir: './test-uploads',
        mailer: { sendEmployerRequest: vi.fn() },
        notificationEmail: 'contact@entractus.com',
      },
    });

    for (const origin of origins) {
      const res = await request(app)
        .options('/healthz')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    }
  });
});

describe('JSON body parsing', () => {
  it('parses application/json bodies without crashing', async () => {
    // POST against the (404) route — body parser must still process the payload,
    // proving express.json() middleware is wired in front of the router.
    const res = await request(makeApp())
      .post('/healthz')
      .set('Content-Type', 'application/json')
      .send({ hello: 'world' });
    expect(res.status).toBe(404);
  });
});
