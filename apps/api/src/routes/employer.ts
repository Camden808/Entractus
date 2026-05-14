import { Router } from 'express';
import { z } from 'zod';
import multer, { type StorageEngine } from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { hashPassword } from '../auth/passwords.js';
import { issueSession, type IssueSessionOptions } from '../auth/session.js';

export interface EmployerRouterOptions extends IssueSessionOptions {
  uploadDir: string;
  // Optional override so tests can swap in memory storage. Production
  // leaves this unset and gets disk storage rooted at uploadDir.
  uploadStorage?: StorageEngine;
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

  return router;
}
