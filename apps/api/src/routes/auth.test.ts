import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { createApp } from '../app.js';

const findUniqueMock = vi.fn();
const createMock = vi.fn();

vi.mock('../db.js', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

const TEST_AUTH = {
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
  isProduction: false,
};

function makeApp() {
  return createApp({
    webOrigin: 'http://localhost:5173',
    auth: TEST_AUTH,
  });
}

const FAKE_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'jane@example.com',
  company: 'Acme Co.',
  displayName: 'Jane Doe',
  timezone: 'UTC',
  role: 'user' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
  });

  it('creates a new user and returns access token + httpOnly refresh cookie on 201', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue(FAKE_USER);

    const res = await request(makeApp()).post('/api/auth/register').send({
      email: 'jane@example.com',
      password: 'correct-horse',
      company: 'Acme Co.',
      displayName: 'Jane Doe',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      id: FAKE_USER.id,
      email: FAKE_USER.email,
      company: 'Acme Co.',
      displayName: 'Jane Doe',
      timezone: 'UTC',
      role: 'user',
    });
    // Never leak the hash.
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.user).not.toHaveProperty('password');

    // Access token is a valid JWT signed with our test secret.
    expect(res.body.accessToken).toBeTypeOf('string');
    const decoded = jwt.verify(res.body.accessToken, TEST_AUTH.jwtAccessSecret) as {
      sub: string;
      role: string;
      exp: number;
      iat: number;
    };
    expect(decoded.sub).toBe(FAKE_USER.id);
    expect(decoded.role).toBe('user');
    expect(decoded.exp - decoded.iat).toBe(TEST_AUTH.accessTokenTtlSeconds);

    // Refresh token cookie is set, httpOnly, scoped to /api/auth.
    const setCookieHeader = res.headers['set-cookie'];
    const setCookie = (
      Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : []
    ) as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Lax/i);
    expect(refreshCookie).toMatch(/Path=\/api\/auth/);
    expect(refreshCookie).not.toMatch(/Secure/i); // isProduction: false

    // The refresh token itself decodes with the refresh secret + carries a jti.
    const rawRefresh = refreshCookie?.split(';')[0]?.split('=')[1] ?? '';
    const refreshDecoded = jwt.verify(rawRefresh, TEST_AUTH.jwtRefreshSecret) as {
      sub: string;
      jti: string;
    };
    expect(refreshDecoded.sub).toBe(FAKE_USER.id);
    expect(typeof refreshDecoded.jti).toBe('string');
  });

  it('persists the password as a bcrypt hash, not plaintext', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue(FAKE_USER);

    await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'correct-horse' });

    expect(createMock).toHaveBeenCalledTimes(1);
    const [arg] = createMock.mock.calls[0] as unknown as [{ data: { passwordHash: string } }];
    expect(arg.data.passwordHash).toBeDefined();
    expect(arg.data.passwordHash).not.toBe('correct-horse');
    // bcrypt $2a$/$2b$/$2y$ prefix.
    expect(arg.data.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('lowercases the email before lookup and storage', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ ...FAKE_USER, email: 'jane@example.com' });

    await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'JANE@Example.COM', password: 'correct-horse' });

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { email: 'jane@example.com' } });
    const [createArg] = createMock.mock.calls[0] as unknown as [{ data: { email: string } }];
    expect(createArg.data.email).toBe('jane@example.com');
  });

  it('defaults timezone to UTC when omitted', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockResolvedValue(FAKE_USER);

    await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'correct-horse' });

    const [createArg] = createMock.mock.calls[0] as unknown as [{ data: { timezone: string } }];
    expect(createArg.data.timezone).toBe('UTC');
  });

  it('returns 409 when the email is already taken', async () => {
    findUniqueMock.mockResolvedValue({ id: 'existing', email: 'jane@example.com' });

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'correct-horse' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'email_taken' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns 409 if a race creates the user between findUnique and create', async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ email: 'jane@example.com', password: 'correct-horse' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'email_taken' });
  });

  it.each([
    { case: 'invalid email', body: { email: 'not-an-email', password: 'correct-horse' } },
    { case: 'missing email', body: { password: 'correct-horse' } },
    { case: 'missing password', body: { email: 'jane@example.com' } },
    { case: 'short password', body: { email: 'jane@example.com', password: 'short' } },
    {
      case: 'password longer than 72 bytes',
      body: { email: 'jane@example.com', password: 'a'.repeat(73) },
    },
  ])('returns 400 with Zod issues for $case', async ({ body }) => {
    const res = await request(makeApp()).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  const PASSWORD = 'correct-horse';
  let passwordHash: string;

  beforeEach(async () => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    // Compute once per test so it reflects real bcrypt output, not a placeholder.
    passwordHash = await bcrypt.hash(PASSWORD, 4); // low rounds = fast tests
  });

  it('returns 200 with access token + httpOnly refresh cookie on valid credentials', async () => {
    findUniqueMock.mockResolvedValue({ ...FAKE_USER, passwordHash });

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: FAKE_USER.id,
      email: FAKE_USER.email,
      company: 'Acme Co.',
      displayName: 'Jane Doe',
      timezone: 'UTC',
      role: 'user',
    });
    // The response must never leak the password hash.
    expect(res.body.user).not.toHaveProperty('passwordHash');

    // Access token decodes and has the right claims + TTL.
    const decoded = jwt.verify(res.body.accessToken, TEST_AUTH.jwtAccessSecret) as {
      sub: string;
      role: string;
      exp: number;
      iat: number;
    };
    expect(decoded.sub).toBe(FAKE_USER.id);
    expect(decoded.role).toBe('user');
    expect(decoded.exp - decoded.iat).toBe(TEST_AUTH.accessTokenTtlSeconds);

    // Refresh cookie: same shape as register.
    const setCookieHeader = res.headers['set-cookie'];
    const setCookie = (
      Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : []
    ) as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Lax/i);
    expect(refreshCookie).toMatch(/Path=\/api\/auth/);
    expect(refreshCookie).not.toMatch(/Secure/i);

    const rawRefresh = refreshCookie?.split(';')[0]?.split('=')[1] ?? '';
    const refreshDecoded = jwt.verify(rawRefresh, TEST_AUTH.jwtRefreshSecret) as {
      sub: string;
      jti: string;
    };
    expect(refreshDecoded.sub).toBe(FAKE_USER.id);
    expect(typeof refreshDecoded.jti).toBe('string');
  });

  it('lowercases the email before lookup', async () => {
    findUniqueMock.mockResolvedValue({ ...FAKE_USER, passwordHash });

    await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'JANE@Example.COM', password: PASSWORD });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { email: 'jane@example.com' },
      select: expect.objectContaining({ passwordHash: true }),
    });
  });

  it('returns 401 with a generic message when the user does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns 401 with the same generic message when the password is wrong', async () => {
    findUniqueMock.mockResolvedValue({ ...FAKE_USER, passwordHash });

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    { case: 'invalid email', body: { email: 'not-an-email', password: 'anything' } },
    { case: 'missing email', body: { password: 'anything' } },
    { case: 'missing password', body: { email: 'jane@example.com' } },
    { case: 'empty password', body: { email: 'jane@example.com', password: '' } },
  ])('returns 400 with Zod issues for $case', async ({ body }) => {
    const res = await request(makeApp()).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
