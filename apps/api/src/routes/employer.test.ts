import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { createApp } from '../app.js';

const userFindUniqueMock = vi.fn();
const userCreateMock = vi.fn();
const requestFindUniqueMock = vi.fn();
const requestCreateMock = vi.fn();

vi.mock('../db.js', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUniqueMock(...args),
      create: (...args: unknown[]) => userCreateMock(...args),
      update: vi.fn(),
      delete: vi.fn(),
    },
    revokedRefreshToken: { findUnique: vi.fn(), create: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    employerRequest: {
      findUnique: (...args: unknown[]) => requestFindUniqueMock(...args),
      create: (...args: unknown[]) => requestCreateMock(...args),
    },
    $transaction: vi.fn(),
  },
}));

const SESSION_OPTS = {
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
  isProduction: false,
};

function makeApp() {
  return createApp({
    webOrigin: 'http://localhost:5173',
    auth: {
      ...SESSION_OPTS,
      passwordResetTtlSeconds: 60 * 60,
      mailer: { sendPasswordReset: vi.fn() },
      webBaseUrl: 'http://localhost:5173',
    },
    employer: {
      ...SESSION_OPTS,
      uploadDir: './test-uploads',
      // Memory storage so tests never write to disk; req.file.filename
      // is unset, which is what the no-file path tests assume.
      uploadStorage: multer.memoryStorage(),
    },
  });
}

// Properly-formed UUIDv4 (version digit '4', variant digit in {8,9,a,b}).
// The earlier 33...3 / 44...4 ids only worked in contexts that don't
// validate UUID format — Zod's .uuid() on signupSchema.requestId does.
const REQUEST_ID = 'a3c4d5e6-1234-4abc-9def-0123456789ab';
const USER_ID = 'b3c4d5e6-1234-4abc-9def-0123456789ab';

const VALID_FORM = {
  firstName: 'Pat',
  lastName: 'Lee',
  company: 'Bridge Co.',
  addressLine1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  phone: '+1-555-0100',
  email: 'pat@bridge.example',
  positionTitle: 'Project Manager',
  positionType: 'Direct Hire',
  hours: 'Full Time',
  duties: 'Run multifamily builds.',
};

describe('POST /api/employer/request', () => {
  beforeEach(() => {
    requestCreateMock.mockReset();
  });

  it('creates an EmployerRequest with all form fields and returns 201 with the id', async () => {
    const created = { id: REQUEST_ID, createdAt: new Date('2026-05-14T12:00:00Z') };
    requestCreateMock.mockResolvedValue(created);

    const res = await request(makeApp()).post('/api/employer/request').send(VALID_FORM);

    expect(res.status).toBe(201);
    expect(res.body.requestId).toBe(REQUEST_ID);
    expect(typeof res.body.createdAt).toBe('string');

    expect(requestCreateMock).toHaveBeenCalledTimes(1);
    const [arg] = requestCreateMock.mock.calls[0] as unknown as [{ data: Record<string, unknown> }];
    // Every supplied form field is persisted.
    expect(arg.data.firstName).toBe('Pat');
    expect(arg.data.lastName).toBe('Lee');
    expect(arg.data.company).toBe('Bridge Co.');
    expect(arg.data.addressLine1).toBe('123 Main St');
    expect(arg.data.city).toBe('Austin');
    expect(arg.data.state).toBe('TX');
    expect(arg.data.phone).toBe('+1-555-0100');
    expect(arg.data.email).toBe('pat@bridge.example');
    expect(arg.data.positionTitle).toBe('Project Manager');
    expect(arg.data.positionType).toBe('Direct Hire');
    expect(arg.data.hours).toBe('Full Time');
    expect(arg.data.duties).toBe('Run multifamily builds.');
    // No file -> jobDescriptionPath is null
    expect(arg.data.jobDescriptionPath).toBeNull();
    // Optional fields not supplied -> null in DB
    expect(arg.data.addressLine2).toBeNull();
    expect(arg.data.positionName).toBeNull();
    expect(arg.data.referralSource).toBeNull();
    expect(arg.data.questions).toBeNull();
  });

  it('lowercases the email before storage', async () => {
    requestCreateMock.mockResolvedValue({ id: REQUEST_ID, createdAt: new Date() });

    await request(makeApp())
      .post('/api/employer/request')
      .send({ ...VALID_FORM, email: 'PAT@Bridge.EXAMPLE' });

    const [arg] = requestCreateMock.mock.calls[0] as unknown as [{ data: { email: string } }];
    expect(arg.data.email).toBe('pat@bridge.example');
  });

  it('accepts a multipart/form-data submission with a job description file', async () => {
    requestCreateMock.mockResolvedValue({ id: REQUEST_ID, createdAt: new Date() });

    const res = await request(makeApp())
      .post('/api/employer/request')
      .field('firstName', VALID_FORM.firstName)
      .field('lastName', VALID_FORM.lastName)
      .field('company', VALID_FORM.company)
      .field('addressLine1', VALID_FORM.addressLine1)
      .field('phone', VALID_FORM.phone)
      .field('email', VALID_FORM.email)
      .attach('jobDescription', Buffer.from('pretend pdf content'), 'jd.pdf');

    expect(res.status).toBe(201);
    expect(res.body.requestId).toBe(REQUEST_ID);
    // memoryStorage doesn't populate req.file.filename, so the handler
    // stores null. The important behavior — that the multipart body parsed,
    // the form fields validated, and the row was created — is what we're
    // testing here. The filename path is covered by the production
    // diskStorage code path.
    expect(requestCreateMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { case: 'missing firstName', body: { ...VALID_FORM, firstName: undefined } },
    { case: 'missing email', body: { ...VALID_FORM, email: undefined } },
    { case: 'invalid email', body: { ...VALID_FORM, email: 'not-an-email' } },
    { case: 'missing company', body: { ...VALID_FORM, company: undefined } },
    { case: 'missing addressLine1', body: { ...VALID_FORM, addressLine1: undefined } },
    { case: 'missing phone', body: { ...VALID_FORM, phone: undefined } },
  ])('returns 400 with Zod issues for $case', async ({ body }) => {
    const cleaned = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    const res = await request(makeApp()).post('/api/employer/request').send(cleaned);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(requestCreateMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/employer/signup', () => {
  const STORED_REQUEST = {
    id: REQUEST_ID,
    firstName: 'Pat',
    lastName: 'Lee',
    company: 'Bridge Co.',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Austin',
    state: 'TX',
    phone: '+1-555-0100',
    email: 'pat@bridge.example',
    positionName: null,
    positionTitle: 'Project Manager',
    positionType: 'Direct Hire',
    hours: 'Full Time',
    duties: 'Run multifamily builds.',
    referralSource: null,
    questions: null,
    jobDescriptionPath: null,
    createdAt: new Date(),
  };

  const FAKE_NEW_USER = {
    id: USER_ID,
    email: STORED_REQUEST.email,
    company: STORED_REQUEST.company,
    displayName: 'Pat Lee',
    timezone: 'UTC',
    role: 'user' as const,
    createdAt: new Date(),
  };

  beforeEach(() => {
    requestFindUniqueMock.mockReset();
    userFindUniqueMock.mockReset();
    userCreateMock.mockReset();
  });

  it('creates a user from the request and issues a session (201)', async () => {
    requestFindUniqueMock.mockResolvedValue(STORED_REQUEST);
    userFindUniqueMock.mockResolvedValue(null);
    userCreateMock.mockResolvedValue(FAKE_NEW_USER);

    const res = await request(makeApp())
      .post('/api/employer/signup')
      .send({ requestId: REQUEST_ID, password: 'correct-horse' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      id: USER_ID,
      email: STORED_REQUEST.email,
      company: STORED_REQUEST.company,
      displayName: 'Pat Lee',
      role: 'user',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toBeTypeOf('string');

    // User created with the request's email + company and a hashed password.
    const [createArg] = userCreateMock.mock.calls[0] as unknown as [
      { data: { email: string; company: string; passwordHash: string; displayName: string } },
    ];
    expect(createArg.data.email).toBe(STORED_REQUEST.email);
    expect(createArg.data.company).toBe(STORED_REQUEST.company);
    expect(createArg.data.displayName).toBe('Pat Lee');
    expect(createArg.data.passwordHash).toMatch(/^\$2[aby]\$/);

    // Same access-token claims + refresh cookie shape as register/login.
    const decoded = jwt.verify(res.body.accessToken, SESSION_OPTS.jwtAccessSecret) as {
      sub: string;
      role: string;
    };
    expect(decoded.sub).toBe(USER_ID);
    expect(decoded.role).toBe('user');

    const setCookie = (res.headers['set-cookie'] ?? []) as string[];
    const refreshCookie = setCookie.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Path=\/api\/auth/);
  });

  it('returns 404 request_not_found when the requestId is unknown', async () => {
    requestFindUniqueMock.mockResolvedValue(null);

    const res = await request(makeApp())
      .post('/api/employer/signup')
      .send({ requestId: REQUEST_ID, password: 'correct-horse' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'request_not_found' });
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it('returns 409 email_taken when a user already exists for the request email', async () => {
    requestFindUniqueMock.mockResolvedValue(STORED_REQUEST);
    userFindUniqueMock.mockResolvedValue({ id: 'someone-else', email: STORED_REQUEST.email });

    const res = await request(makeApp())
      .post('/api/employer/signup')
      .send({ requestId: REQUEST_ID, password: 'correct-horse' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'email_taken' });
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it('returns 409 email_taken on a Prisma P2002 race', async () => {
    requestFindUniqueMock.mockResolvedValue(STORED_REQUEST);
    userFindUniqueMock.mockResolvedValue(null);
    userCreateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    const res = await request(makeApp())
      .post('/api/employer/signup')
      .send({ requestId: REQUEST_ID, password: 'correct-horse' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'email_taken' });
  });

  it.each([
    { case: 'missing requestId', body: { password: 'correct-horse' } },
    { case: 'non-UUID requestId', body: { requestId: 'not-a-uuid', password: 'correct-horse' } },
    { case: 'missing password', body: { requestId: REQUEST_ID } },
    { case: 'short password', body: { requestId: REQUEST_ID, password: 'short' } },
    { case: 'oversize password', body: { requestId: REQUEST_ID, password: 'a'.repeat(73) } },
  ])('returns 400 with Zod issues for $case', async ({ body }) => {
    const res = await request(makeApp()).post('/api/employer/signup').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(requestFindUniqueMock).not.toHaveBeenCalled();
    expect(userCreateMock).not.toHaveBeenCalled();
  });
});
