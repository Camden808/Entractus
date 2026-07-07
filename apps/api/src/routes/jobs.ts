import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

// Pagination ceiling. 100 is generous for a job board listings query
// and prevents pathological page sizes from a public endpoint.
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const listJobsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  state: z.string().trim().min(1).max(100).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  type: z.string().trim().min(1).max(40).optional(),
  company: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const PUBLIC_JOB_SELECT = {
  id: true,
  title: true,
  state: true,
  city: true,
  type: true,
  company: true,
  postedDate: true,
  description: true,
} as const;

export function createJobsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    const parsed = listJobsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const { q, state, city, type, company, page, pageSize } = parsed.data;

    const where: Prisma.JobPostingWhereInput = {};
    if (q) where.title = { contains: q, mode: 'insensitive' };
    if (state) where.state = state;
    if (city) where.city = city;
    if (type) where.type = type;
    if (company) where.company = company;

    try {
      // Count + page query in parallel so the round-trip is the slower of
      // the two, not the sum.
      const [total, items] = await Promise.all([
        prisma.jobPosting.count({ where }),
        prisma.jobPosting.findMany({
          where,
          select: PUBLIC_JOB_SELECT,
          orderBy: { postedDate: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return res.json({ items, total, page, pageSize });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
