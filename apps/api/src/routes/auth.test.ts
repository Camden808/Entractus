import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { createApp } from '../app.js';

const findUniqueMock = vi.fn();
const createMock = vi.fn();
const userUpdateMock = vi.fn();
const revokedFindUniqueMock = vi.fn();
const revokedCreateMock = vi.fn();
const resetFindUniqueMock = vi.fn();
const resetCreateMock = vi.fn();
const resetUpdateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock('../db.js', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => userUpdateMock(...args),
    },
    revokedRefreshToken: {
      findUnique: (...args: unknown[]) => revokedFindUniqueMock(...args),
      create: (...args: unknown[]) => revokedCreateMock(...args),
    },
    passwordResetToken: {
      findUnique: (...args: unknown[]) => resetFindUniqueMock(...args),
      create: (...args: unknown[]) => resetCreateMock(...args),
      update: (...args: unknown[]) => resetUpdateMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

const sendPasswordResetMock = vi.fn();

const TEST_AUTH = {
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
  passwordResetTtlSeconds: 60 * 60,
  isProduction: false,
  mailer: { sendPasswordReset: sendPasswordResetMock },
  webBaseUrl: 'http://localhost:5173',
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

// --- Refresh + logout ---

function signRefreshCookie(opts: { sub: string; jti: string; ttlSec?: number }): string {
  return jwt.sign({ sub: opts.sub, jti: opts.jti }, TEST_AUTH.jwtRefreshSecret, {
    expiresIn: opts.ttlSec ?? TEST_AUTH.refreshTokenTtlSeconds,
  });
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    revokedFindUniqueMock.mockReset();
    revokedCreateMock.mockReset();
  });

  it('returns 401 when no refresh cookie is present', async () => {
    const res = await request(makeApp()).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'no_refresh_token' });
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(revokedFindUniqueMock).not.toHaveBeenCalled();
  });

  it('returns 401 + clears cookie for a malformed/invalid token', async () => {
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', ['refresh_token=not-a-real-jwt']);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_refresh_token' });
    const setCookie = (res.headers['set-cookie'] ?? []) as string[];
    expect(setCookie.some((c) => /^refresh_token=;/.test(c))).toBe(true);
  });

  it('returns 401 + clears cookie for a wrong-secret token', async () => {
    const badToken = jwt.sign({ sub: FAKE_USER.id, jti: randomJti() }, 'totally-different-secret', {
      expiresIn: 3600,
    });
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${badToken}`]);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_refresh_token' });
  });

  it('returns 401 + clears cookie for an expired token', async () => {
    const expiredToken = jwt.sign(
      { sub: FAKE_USER.id, jti: randomJti() },
      TEST_AUTH.jwtRefreshSecret,
      { expiresIn: -10 },
    );
    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${expiredToken}`]);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'refresh_token_expired' });
  });

  it('returns 401 when the jti is in the revocation list', async () => {
    const jti = randomJti();
    const token = signRefreshCookie({ sub: FAKE_USER.id, jti });
    revokedFindUniqueMock.mockResolvedValue({
      jti,
      userId: FAKE_USER.id,
      expiresAt: new Date(Date.now() + 3600_000),
      revokedAt: new Date(),
    });

    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${token}`]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'refresh_token_revoked' });
    expect(revokedFindUniqueMock).toHaveBeenCalledWith({ where: { jti } });
    expect(revokedCreateMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the user has been deleted since the token was issued', async () => {
    const jti = randomJti();
    const token = signRefreshCookie({ sub: FAKE_USER.id, jti });
    revokedFindUniqueMock.mockResolvedValue(null);
    findUniqueMock.mockResolvedValue(null); // user is gone

    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${token}`]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_refresh_token' });
    expect(revokedCreateMock).not.toHaveBeenCalled();
  });

  it('rotates: revokes old jti, issues new access + refresh cookie', async () => {
    const oldJti = randomJti();
    const token = signRefreshCookie({ sub: FAKE_USER.id, jti: oldJti });
    revokedFindUniqueMock.mockResolvedValue(null);
    findUniqueMock.mockResolvedValue({ id: FAKE_USER.id, role: 'user' });
    revokedCreateMock.mockResolvedValue({
      jti: oldJti,
      userId: FAKE_USER.id,
      expiresAt: new Date(Date.now() + 3600_000),
      revokedAt: new Date(),
    });

    const res = await request(makeApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`refresh_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');

    // Old jti was added to the revocation list with the user id and the
    // original expiry from the JWT.
    expect(revokedCreateMock).toHaveBeenCalledTimes(1);
    const [revokeArg] = revokedCreateMock.mock.calls[0] as unknown as [
      { data: { jti: string; userId: string; expiresAt: Date } },
    ];
    expect(revokeArg.data.jti).toBe(oldJti);
    expect(revokeArg.data.userId).toBe(FAKE_USER.id);
    expect(revokeArg.data.expiresAt).toBeInstanceOf(Date);

    // New access token verifies with the right claims.
    const decoded = jwt.verify(res.body.accessToken, TEST_AUTH.jwtAccessSecret) as {
      sub: string;
      role: string;
    };
    expect(decoded.sub).toBe(FAKE_USER.id);
    expect(decoded.role).toBe('user');

    // New refresh cookie issued with a different jti than the old one.
    const setCookie = (res.headers['set-cookie'] ?? []) as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    const raw = refreshCookie?.split(';')[0]?.split('=')[1] ?? '';
    const newPayload = jwt.verify(raw, TEST_AUTH.jwtRefreshSecret) as {
      jti: string;
    };
    expect(newPayload.jti).not.toBe(oldJti);
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    revokedFindUniqueMock.mockReset();
    revokedCreateMock.mockReset();
  });

  it('returns 204 and clears the cookie even when no token is present', async () => {
    const res = await request(makeApp()).post('/api/auth/logout');
    expect(res.status).toBe(204);
    const setCookie = (res.headers['set-cookie'] ?? []) as string[];
    expect(setCookie.some((c) => /^refresh_token=;/.test(c))).toBe(true);
    expect(revokedCreateMock).not.toHaveBeenCalled();
  });

  it('revokes the jti when a valid token is presented', async () => {
    const jti = randomJti();
    const token = signRefreshCookie({ sub: FAKE_USER.id, jti });
    revokedCreateMock.mockResolvedValue({
      jti,
      userId: FAKE_USER.id,
      expiresAt: new Date(),
      revokedAt: new Date(),
    });

    const res = await request(makeApp())
      .post('/api/auth/logout')
      .set('Cookie', [`refresh_token=${token}`]);

    expect(res.status).toBe(204);
    expect(revokedCreateMock).toHaveBeenCalledTimes(1);
    const [arg] = revokedCreateMock.mock.calls[0] as unknown as [
      { data: { jti: string; userId: string } },
    ];
    expect(arg.data.jti).toBe(jti);
    expect(arg.data.userId).toBe(FAKE_USER.id);
  });

  it('is idempotent when the jti is already revoked (P2002 swallowed)', async () => {
    const jti = randomJti();
    const token = signRefreshCookie({ sub: FAKE_USER.id, jti });
    revokedCreateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    const res = await request(makeApp())
      .post('/api/auth/logout')
      .set('Cookie', [`refresh_token=${token}`]);

    expect(res.status).toBe(204);
  });

  it('returns 204 and skips DB writes for an expired or malformed token', async () => {
    const expiredToken = jwt.sign(
      { sub: FAKE_USER.id, jti: randomJti() },
      TEST_AUTH.jwtRefreshSecret,
      { expiresIn: -10 },
    );

    const res = await request(makeApp())
      .post('/api/auth/logout')
      .set('Cookie', [`refresh_token=${expiredToken}`]);

    expect(res.status).toBe(204);
    expect(revokedCreateMock).not.toHaveBeenCalled();
  });
});

function randomJti(): string {
  return crypto.randomUUID();
}

// --- Password reset ---

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    resetCreateMock.mockReset();
    sendPasswordResetMock.mockReset();
  });

  it('returns 202 and sends an email when the user exists', async () => {
    findUniqueMock.mockResolvedValue({ id: FAKE_USER.id, email: FAKE_USER.email });
    resetCreateMock.mockResolvedValue({});
    sendPasswordResetMock.mockResolvedValue(undefined);

    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'jane@example.com' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'accepted' });

    // Token row created with a hash (not the raw token) and an expiry in
    // the future.
    expect(resetCreateMock).toHaveBeenCalledTimes(1);
    const [createArg] = resetCreateMock.mock.calls[0] as unknown as [
      { data: { tokenHash: string; userId: string; expiresAt: Date } },
    ];
    expect(createArg.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArg.data.userId).toBe(FAKE_USER.id);
    expect(createArg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Mailer called with the user's email and a reset URL that contains
    // a raw token whose sha256 matches the row's tokenHash.
    expect(sendPasswordResetMock).toHaveBeenCalledTimes(1);
    const [sendArg] = sendPasswordResetMock.mock.calls[0] as unknown as [
      { to: string; resetUrl: string; ttlMinutes: number },
    ];
    expect(sendArg.to).toBe(FAKE_USER.email);
    expect(sendArg.resetUrl).toContain(`${TEST_AUTH.webBaseUrl}/reset-password?token=`);
    expect(sendArg.ttlMinutes).toBe(60);
    const rawToken = decodeURIComponent(sendArg.resetUrl.split('?token=')[1] ?? '');
    expect(rawToken.length).toBeGreaterThan(10);
    expect(sha256Hex(rawToken)).toBe(createArg.data.tokenHash);
  });

  it('returns 202 (same shape) when the email is unknown — no DB write, no email', async () => {
    findUniqueMock.mockResolvedValue(null);

    const res = await request(makeApp())
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'accepted' });
    expect(resetCreateMock).not.toHaveBeenCalled();
    expect(sendPasswordResetMock).not.toHaveBeenCalled();
  });

  it('lowercases the email before lookup', async () => {
    findUniqueMock.mockResolvedValue(null);

    await request(makeApp()).post('/api/auth/forgot-password').send({ email: 'JANE@Example.COM' });

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { email: 'jane@example.com' },
      select: { id: true, email: true },
    });
  });

  it.each([
    { case: 'invalid email', body: { email: 'not-an-email' } },
    { case: 'missing email', body: {} },
  ])('returns 400 with Zod issues for $case', async ({ body }) => {
    const res = await request(makeApp()).post('/api/auth/forgot-password').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(sendPasswordResetMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset-password', () => {
  const RAW_TOKEN = 'a-very-random-reset-token-value-for-tests';
  const TOKEN_HASH = sha256Hex(RAW_TOKEN);

  beforeEach(() => {
    resetFindUniqueMock.mockReset();
    transactionMock.mockReset();
  });

  it('hashes the new password, burns the token in a transaction, returns 200', async () => {
    const record = {
      id: '22222222-2222-2222-2222-222222222222',
      tokenHash: TOKEN_HASH,
      userId: FAKE_USER.id,
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: null,
      createdAt: new Date(),
    };
    resetFindUniqueMock.mockResolvedValue(record);
    transactionMock.mockResolvedValue([null, null]);

    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: RAW_TOKEN, password: 'new-correct-horse' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });

    expect(resetFindUniqueMock).toHaveBeenCalledWith({ where: { tokenHash: TOKEN_HASH } });

    // Transaction received two PrismaPromise-shaped ops; we can't deeply
    // inspect them because they're lazy Prisma proxies, but we can confirm
    // the call shape and arity.
    expect(transactionMock).toHaveBeenCalledTimes(1);
    const [ops] = transactionMock.mock.calls[0] as unknown as [unknown[]];
    expect(Array.isArray(ops)).toBe(true);
    expect(ops).toHaveLength(2);
  });

  it('returns 400 invalid_or_expired_token when the token is unknown', async () => {
    resetFindUniqueMock.mockResolvedValue(null);

    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: RAW_TOKEN, password: 'new-correct-horse' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_or_expired_token' });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_or_expired_token when the token is already used', async () => {
    resetFindUniqueMock.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      tokenHash: TOKEN_HASH,
      userId: FAKE_USER.id,
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: new Date(),
      createdAt: new Date(),
    });

    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: RAW_TOKEN, password: 'new-correct-horse' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_or_expired_token' });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_or_expired_token when the token is expired', async () => {
    resetFindUniqueMock.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      tokenHash: TOKEN_HASH,
      userId: FAKE_USER.id,
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date(),
    });

    const res = await request(makeApp())
      .post('/api/auth/reset-password')
      .send({ token: RAW_TOKEN, password: 'new-correct-horse' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_or_expired_token' });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it.each([
    { case: 'missing token', body: { password: 'new-correct-horse' } },
    { case: 'missing password', body: { token: RAW_TOKEN } },
    { case: 'short password', body: { token: RAW_TOKEN, password: 'short' } },
    {
      case: 'oversize password',
      body: { token: RAW_TOKEN, password: 'a'.repeat(73) },
    },
  ])('returns 400 with Zod issues for $case', async ({ body }) => {
    const res = await request(makeApp()).post('/api/auth/reset-password').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(resetFindUniqueMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
