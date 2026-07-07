import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const findManyMock = vi.fn();
const countMock = vi.fn();

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    revokedRefreshToken: { findUnique: vi.fn(), create: vi.fn() },
    passwordResetToken: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    employerRequest: { findUnique: vi.fn(), create: vi.fn() },
    jobPosting: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
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
      mailer: { sendEmployerRequest: vi.fn() },
      notificationEmail: 'contact@entractus.com',
    },
  });
}

const SAMPLE_JOBS = [
  {
    id: 'job-1',
    title: 'Senior Civil Engineer',
    state: 'CA',
    city: 'San Francisco',
    type: 'Direct Hire',
    company: 'Bay Bridge Builders',
    postedDate: new Date('2026-05-10T00:00:00Z'),
    description: 'desc 1',
  },
  {
    id: 'job-2',
    title: 'Construction Project Manager',
    state: 'TX',
    city: 'Austin',
    type: 'Direct Hire',
    company: 'Lone Star Construction',
    postedDate: new Date('2026-05-09T00:00:00Z'),
    description: 'desc 2',
  },
];

describe('GET /api/jobs', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    countMock.mockReset();
    findManyMock.mockResolvedValue(SAMPLE_JOBS);
    countMock.mockResolvedValue(42);
  });

  it('returns a 500 (not a crash) with a detail when the DB query fails', async () => {
    countMock.mockRejectedValue(new Error('Cant reach database server'));
    findManyMock.mockRejectedValue(new Error('Cant reach database server'));

    const res = await request(makeApp()).get('/api/jobs');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_error');
    expect(res.body.detail).toContain('Cant reach database server');
  });

  it('returns items + total + pagination metadata; defaults page=1, pageSize=20', async () => {
    const res = await request(makeApp()).get('/api/jobs');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(42);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.items).toHaveLength(SAMPLE_JOBS.length);
    expect(res.body.items[0]).toMatchObject({
      id: 'job-1',
      title: 'Senior Civil Engineer',
      state: 'CA',
      city: 'San Francisco',
      type: 'Direct Hire',
      company: 'Bay Bridge Builders',
    });

    // findMany was called with no filters, skip=0, take=20, ordered by postedDate desc.
    const [arg] = findManyMock.mock.calls[0] as unknown as [
      {
        where: object;
        orderBy: { postedDate: 'desc' };
        skip: number;
        take: number;
      },
    ];
    expect(arg.where).toEqual({});
    expect(arg.orderBy).toEqual({ postedDate: 'desc' });
    expect(arg.skip).toBe(0);
    expect(arg.take).toBe(20);
    // count was called with the same where.
    const [countArg] = countMock.mock.calls[0] as unknown as [{ where: object }];
    expect(countArg.where).toEqual({});
  });

  it('applies the q search as a case-insensitive title contains', async () => {
    await request(makeApp()).get('/api/jobs').query({ q: 'engineer' });

    const [arg] = findManyMock.mock.calls[0] as unknown as [
      { where: { title?: { contains: string; mode: string } } },
    ];
    expect(arg.where.title).toEqual({ contains: 'engineer', mode: 'insensitive' });
  });

  it('applies state, city, type, company as exact-match filters', async () => {
    await request(makeApp()).get('/api/jobs').query({
      state: 'CA',
      city: 'San Francisco',
      type: 'Direct Hire',
      company: 'Bay Bridge Builders',
    });

    const [arg] = findManyMock.mock.calls[0] as unknown as [
      {
        where: { state?: string; city?: string; type?: string; company?: string };
      },
    ];
    expect(arg.where.state).toBe('CA');
    expect(arg.where.city).toBe('San Francisco');
    expect(arg.where.type).toBe('Direct Hire');
    expect(arg.where.company).toBe('Bay Bridge Builders');
  });

  it('combines q with filters in the same where clause', async () => {
    await request(makeApp()).get('/api/jobs').query({ q: 'manager', state: 'TX' });

    const [arg] = findManyMock.mock.calls[0] as unknown as [
      {
        where: { title?: { contains: string; mode: string }; state?: string };
      },
    ];
    expect(arg.where.title).toEqual({ contains: 'manager', mode: 'insensitive' });
    expect(arg.where.state).toBe('TX');
  });

  it('paginates: page=3, pageSize=10 -> skip=20, take=10', async () => {
    const res = await request(makeApp()).get('/api/jobs').query({ page: 3, pageSize: 10 });

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.pageSize).toBe(10);

    const [arg] = findManyMock.mock.calls[0] as unknown as [{ skip: number; take: number }];
    expect(arg.skip).toBe(20);
    expect(arg.take).toBe(10);
  });

  it('coerces string query params to numbers (Express query strings are strings)', async () => {
    await request(makeApp()).get('/api/jobs?page=2&pageSize=5');

    const [arg] = findManyMock.mock.calls[0] as unknown as [{ skip: number; take: number }];
    expect(arg.skip).toBe(5);
    expect(arg.take).toBe(5);
  });

  it.each([
    { case: 'page=0', query: { page: 0 } },
    { case: 'negative page', query: { page: -1 } },
    { case: 'pageSize=0', query: { pageSize: 0 } },
    { case: 'pageSize>100', query: { pageSize: 101 } },
    { case: 'non-integer page', query: { page: 1.5 } },
  ])('returns 400 invalid_request for $case', async ({ query }) => {
    const res = await request(makeApp()).get('/api/jobs').query(query);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(findManyMock).not.toHaveBeenCalled();
    expect(countMock).not.toHaveBeenCalled();
  });

  it('drops empty-string filters via the trim+min(1) Zod refinement (effectively returns 400)', async () => {
    // q='' is sent — Zod rejects it because trim().min(1) requires at least 1 char.
    const res = await request(makeApp()).get('/api/jobs').query({ q: '' });
    expect(res.status).toBe(400);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
