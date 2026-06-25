import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../db.js', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: vi.fn(),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
    revokedRefreshToken: { findUnique: vi.fn(), create: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    employerRequest: { findUnique: vi.fn(), create: vi.fn() },
    jobPosting: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const TEST_AUTH = {
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
  passwordResetTtlSeconds: 60 * 60,
  isProduction: false,
  mailer: { sendPasswordReset: vi.fn() },
  webBaseUrl: 'http://localhost:5173',
};

function makeApp() {
  return createApp({
    webOrigin: 'http://localhost:5173',
    auth: TEST_AUTH,
    employer: {
      jwtAccessSecret: TEST_AUTH.jwtAccessSecret,
      jwtRefreshSecret: TEST_AUTH.jwtRefreshSecret,
      accessTokenTtlSeconds: TEST_AUTH.accessTokenTtlSeconds,
      refreshTokenTtlSeconds: TEST_AUTH.refreshTokenTtlSeconds,
      isProduction: false,
      uploadDir: './test-uploads',
      mailer: { sendEmployerRequest: vi.fn() },
      notificationEmail: 'contact@entractus.com',
    },
  });
}

const USER_ID = '11111111-1111-1111-1111-111111111111';
const FAKE_USER = {
  id: USER_ID,
  email: 'jane@example.com',
  company: 'Acme Co.',
  displayName: 'Jane Doe',
  timezone: 'UTC',
  role: 'user' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function userBearer(role: 'user' | 'admin' = 'user', sub = USER_ID, ttlSec = 900): string {
  return jwt.sign({ sub, role }, TEST_AUTH.jwtAccessSecret, { expiresIn: ttlSec });
}

// Build a Prisma P2025 "record not found" error without importing the real
// PrismaClientKnownRequestError (its constructor signature varies across
// versions and isn't relevant to what the route handler checks for).
function notFoundError(): Error {
  const err = new Error('record not found') as Error & { code: string };
  err.code = 'P2025';
  return err;
}

describe('GET /api/users/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  it('returns 401 when no Authorization header is present', async () => {
    const res = await request(makeApp()).get('/api/users/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'missing_access_token' });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is not Bearer', async () => {
    const res = await request(makeApp()).get('/api/users/me').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'missing_access_token' });
  });

  it('returns 401 access_token_expired for an expired JWT', async () => {
    const expired = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_AUTH.jwtAccessSecret, {
      expiresIn: -10,
    });
    const res = await request(makeApp())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'access_token_expired' });
  });

  it('returns 401 invalid_access_token for a wrong-secret JWT', async () => {
    const bad = jwt.sign({ sub: USER_ID, role: 'user' }, 'other-secret', { expiresIn: 900 });
    const res = await request(makeApp()).get('/api/users/me').set('Authorization', `Bearer ${bad}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_access_token' });
  });

  it('returns 401 invalid_access_token for a JWT with no sub or unknown role', async () => {
    const malformed = jwt.sign({ role: 'user' }, TEST_AUTH.jwtAccessSecret, { expiresIn: 900 });
    const res = await request(makeApp())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${malformed}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_access_token' });
  });

  it('returns 200 with the user when authenticated', async () => {
    findUniqueMock.mockResolvedValue(FAKE_USER);

    const res = await request(makeApp())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: USER_ID,
      email: FAKE_USER.email,
      company: 'Acme Co.',
      displayName: 'Jane Doe',
      timezone: 'UTC',
      role: 'user',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    // findUnique was called with this user's id; the select object whitelists
    // public fields only (no passwordHash key present).
    const [findArg] = findUniqueMock.mock.calls[0] as unknown as [
      { where: { id: string }; select: Record<string, true> },
    ];
    expect(findArg.where.id).toBe(USER_ID);
    expect(findArg.select).not.toHaveProperty('passwordHash');
  });

  it('returns 401 user_not_found if the JWT is valid but the user has been deleted', async () => {
    findUniqueMock.mockResolvedValue(null);

    const res = await request(makeApp())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'user_not_found' });
  });
});

describe('PATCH /api/users/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  it('updates displayName and timezone, returns the new user', async () => {
    updateMock.mockResolvedValue({
      ...FAKE_USER,
      displayName: 'Jane Q. Doe',
      timezone: 'America/New_York',
    });

    const res = await request(makeApp())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`)
      .send({ displayName: 'Jane Q. Doe', timezone: 'America/New_York' });

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('Jane Q. Doe');
    expect(res.body.user.timezone).toBe('America/New_York');

    expect(updateMock).toHaveBeenCalledTimes(1);
    const [arg] = updateMock.mock.calls[0] as unknown as [
      { where: { id: string }; data: { displayName?: string; timezone?: string } },
    ];
    expect(arg.where.id).toBe(USER_ID);
    expect(arg.data).toEqual({ displayName: 'Jane Q. Doe', timezone: 'America/New_York' });
  });

  it('accepts a partial body (just displayName)', async () => {
    updateMock.mockResolvedValue({ ...FAKE_USER, displayName: 'Just Jane' });

    const res = await request(makeApp())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`)
      .send({ displayName: 'Just Jane' });

    expect(res.status).toBe(200);
    const [arg] = updateMock.mock.calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(arg.data).toEqual({ displayName: 'Just Jane' });
  });

  it('returns 400 no_fields_to_update for an empty body', async () => {
    const res = await request(makeApp())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'no_fields_to_update' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each([
    { case: 'empty displayName', body: { displayName: '' } },
    { case: 'oversize displayName', body: { displayName: 'x'.repeat(101) } },
    { case: 'empty timezone', body: { timezone: '' } },
    { case: 'oversize timezone', body: { timezone: 'x'.repeat(65) } },
  ])('returns 400 invalid_request for $case', async ({ body }) => {
    const res = await request(makeApp())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns 401 user_not_found if the row vanished between requests', async () => {
    updateMock.mockRejectedValue(notFoundError());

    const res = await request(makeApp())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`)
      .send({ displayName: 'Doesn’t Matter' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'user_not_found' });
  });
});

describe('DELETE /api/users/me', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  it('returns 204 on successful delete', async () => {
    deleteMock.mockResolvedValue(FAKE_USER);

    const res = await request(makeApp())
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: USER_ID } });
  });

  it('is idempotent: returns 204 even when the user is already gone (P2025)', async () => {
    deleteMock.mockRejectedValue(notFoundError());

    const res = await request(makeApp())
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${userBearer()}`);

    expect(res.status).toBe(204);
  });

  it('requires authentication', async () => {
    const res = await request(makeApp()).delete('/api/users/me');
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
