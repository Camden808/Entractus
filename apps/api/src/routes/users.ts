import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';

export interface UsersRouterOptions {
  jwtAccessSecret: string;
}

const updateMeSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  company: true,
  displayName: true,
  timezone: true,
  role: true,
  createdAt: true,
} as const;

export function createUsersRouter(opts: UsersRouterOptions): Router {
  const router = Router();

  // All /me routes require a valid access token.
  router.use(requireAuth({ jwtAccessSecret: opts.jwtAccessSecret }));

  router.get('/me', async (req, res) => {
    // requireAuth populates req.user; types know it's defined past this point
    // but the indexed access still narrows to undefined under strict mode.
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      // Token is valid but the account has been deleted. Treat as 401 so
      // the client clears its session.
      return res.status(401).json({ error: 'user_not_found' });
    }
    return res.json({ user });
  });

  router.patch('/me', async (req, res) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        issues: parsed.error.issues,
      });
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    const userId = req.user!.id;
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: PUBLIC_USER_SELECT,
      });
      return res.json({ user });
    } catch (err) {
      // P2025 = record to update not found (e.g. user deleted concurrently)
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2025') {
        return res.status(401).json({ error: 'user_not_found' });
      }
      throw err;
    }
  });

  router.delete('/me', async (req, res) => {
    const userId = req.user!.id;
    try {
      await prisma.user.delete({ where: { id: userId } });
      return res.status(204).send();
    } catch (err) {
      // P2025 = already gone. Idempotent delete still returns 204.
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2025') {
        return res.status(204).send();
      }
      throw err;
    }
  });

  return router;
}
