import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { hashPassword } from '../auth/passwords.js';
import { signAccessToken, signRefreshToken } from '../auth/jwt.js';

export interface AuthRouterOptions {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  isProduction: boolean;
}

// bcrypt silently truncates at 72 bytes; cap min length at 8 (common floor).
const registerSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(72),
  company: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export function createAuthRouter(opts: AuthRouterOptions): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const { email, password, company, displayName, timezone } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'email_taken' });
    }

    const passwordHash = await hashPassword(password);

    try {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          company: company ?? null,
          displayName: displayName ?? null,
          timezone: timezone ?? 'UTC',
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

      const accessToken = signAccessToken(
        { sub: user.id, role: user.role },
        opts.jwtAccessSecret,
        opts.accessTokenTtlSeconds,
      );
      const refreshToken = signRefreshToken(
        { sub: user.id, jti: randomUUID() },
        opts.jwtRefreshSecret,
        opts.refreshTokenTtlSeconds,
      );

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: opts.isProduction,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: opts.refreshTokenTtlSeconds * 1000,
      });

      return res.status(201).json({ user, accessToken });
    } catch (err) {
      // Race condition: another request created the email between findUnique
      // and create. Prisma surfaces this as P2002 on the unique constraint.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ error: 'email_taken' });
      }
      throw err;
    }
  });

  return router;
}
