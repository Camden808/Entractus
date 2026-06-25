import { Router } from 'express';
import { z } from 'zod';
import multer, { type StorageEngine } from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { hashPassword } from '../auth/passwords.js';
import { issueSession, type IssueSessionOptions } from '../auth/session.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import type { Mailer } from '../mail/mailer.js';

export interface EmployerRouterOptions extends IssueSessionOptions {
  uploadDir: string;
  // Optional override so tests can swap in memory storage. Production
  // leaves this unset and gets disk storage rooted at uploadDir.
  uploadStorage?: StorageEngine;
  mailer: Pick<Mailer, 'sendEmployerRequest'>;
  // Internal recipient for employer-request notifications (Tasks.md §4).
  notificationEmail: string;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const requestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  company: z.string().min(1).max(200),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  phone: z.string().min(1).max(40),
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  positionName: z.string().min(1).max(200).optional(),
  positionTitle: z.string().min(1).max(200).optional(),
  positionType: z.string().min(1).max(40).optional(),
  hours: z.string().min(1).max(40).optional(),
  duties: z.string().min(1).max(5000).optional(),
  referralSource: z.string().min(1).max(200).optional(),
  questions: z.string().min(1).max(5000).optional(),
});

const signupSchema = z.object({
  requestId: z.string().uuid(),
  password: z.string().min(8).max(72),
});

// Admin job-posting schemas (Tasks.md §5.2). Paths are
// POST /api/employer/post, PATCH /api/employer/post/:id,
// POST /api/employer/delete — see the spec for the (slightly unusual)
// shape; we follow it literally.
const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(40),
  company: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  postedDate: z.coerce.date().optional(),
});

// PATCH is partial; every field optional but at least one must be set.
const updatePostSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    state: z.string().trim().min(1).max(100).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    type: z.string().trim().min(1).max(40).optional(),
    company: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(10000).optional(),
    postedDate: z.coerce.date().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'no_fields_to_update' });

const idParamSchema = z.object({ id: z.string().uuid() });
const deleteBodySchema = z.object({ id: z.string().uuid() });

const POST_SELECT = {
  id: true,
  title: true,
  state: true,
  city: true,
  type: true,
  company: true,
  postedDate: true,
  description: true,
  createdById: true,
} as const;

export function createEmployerRouter(opts: EmployerRouterOptions): Router {
  const router = Router();

  const storage =
    opts.uploadStorage ??
    multer.diskStorage({
      destination: opts.uploadDir,
      filename: (_req, file, cb) => {
        // Sanitize to defeat path traversal + collisions.
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${randomUUID()}-${safeName}`);
      },
    });
  const upload = multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  router.post('/request', upload.single('jobDescription'), async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const data = parsed.data;
    const created = await prisma.employerRequest.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        phone: data.phone,
        email: data.email,
        positionName: data.positionName ?? null,
        positionTitle: data.positionTitle ?? null,
        positionType: data.positionType ?? null,
        hours: data.hours ?? null,
        duties: data.duties ?? null,
        referralSource: data.referralSource ?? null,
        questions: data.questions ?? null,
        jobDescriptionPath: req.file?.filename ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // Notify the internal recruitment inbox. The record is already stored,
    // so a mail failure must not fail the submission — log and move on.
    try {
      await opts.mailer.sendEmployerRequest({
        to: opts.notificationEmail,
        replyTo: data.email,
        request: { ...data, jobDescriptionFilename: req.file?.filename ?? null },
        jobDescription: req.file
          ? {
              filename: req.file.originalname,
              ...(req.file.path ? { path: req.file.path } : { content: req.file.buffer }),
            }
          : null,
      });
    } catch (err) {
      console.error('[employer:request] notification email failed', err);
    }

    return res.status(201).json({
      requestId: created.id,
      createdAt: created.createdAt,
    });
  });

  router.post('/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const { requestId, password } = parsed.data;

    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      return res.status(404).json({ error: 'request_not_found' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: request.email },
    });
    if (existing) {
      return res.status(409).json({ error: 'email_taken' });
    }

    const passwordHash = await hashPassword(password);
    const displayName = `${request.firstName} ${request.lastName}`.trim() || null;

    try {
      const user = await prisma.user.create({
        data: {
          email: request.email,
          company: request.company,
          passwordHash,
          displayName,
        },
        select: {
          id: true,
          email: true,
          company: true,
          displayName: true,
          timezone: true,
          role: true,
          createdAt: true,
        },
      });

      const accessToken = issueSession(res, user, opts);
      return res.status(201).json({ user, accessToken });
    } catch (err) {
      // Race: someone else created the user between our findUnique + create.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ error: 'email_taken' });
      }
      throw err;
    }
  });

  // --- Admin-only job-posting management (Tasks.md §5.2) ---

  const adminOnly = [requireAuth({ jwtAccessSecret: opts.jwtAccessSecret }), requireAdmin()];

  router.post('/post', ...adminOnly, async (req, res) => {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const created = await prisma.jobPosting.create({
      data: {
        ...parsed.data,
        createdById: req.user!.id,
      },
      select: POST_SELECT,
    });

    return res.status(201).json({ post: created });
  });

  router.patch('/post/:id', ...adminOnly, async (req, res) => {
    const paramsParsed = idParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      return res.status(400).json({ error: 'invalid_request', issues: paramsParsed.error.issues });
    }

    const bodyParsed = updatePostSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: 'invalid_request', issues: bodyParsed.error.issues });
    }

    try {
      const updated = await prisma.jobPosting.update({
        where: { id: paramsParsed.data.id },
        data: bodyParsed.data,
        select: POST_SELECT,
      });
      return res.json({ post: updated });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return res.status(404).json({ error: 'post_not_found' });
      }
      throw err;
    }
  });

  router.post('/delete', ...adminOnly, async (req, res) => {
    const parsed = deleteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_request', issues: parsed.error.issues });
    }

    try {
      await prisma.jobPosting.delete({ where: { id: parsed.data.id } });
      return res.status(204).send();
    } catch (err) {
      // Idempotent: P2025 (already gone) still ends in the same state.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return res.status(204).send();
      }
      throw err;
    }
  });

  return router;
}
