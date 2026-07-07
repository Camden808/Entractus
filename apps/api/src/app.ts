import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createAuthRouter, type AuthRouterOptions } from './routes/auth.js';
import { createUsersRouter } from './routes/users.js';
import { createEmployerRouter, type EmployerRouterOptions } from './routes/employer.js';
import { createJobsRouter } from './routes/jobs.js';

export interface AppOptions {
  webOrigin: string;
  auth: AuthRouterOptions;
  employer: EmployerRouterOptions;
}

export function createApp({ webOrigin, auth, employer }: AppOptions): Express {
  const app = express();

  // WEB_ORIGIN may be a single origin or a comma-separated list (e.g. the
  // custom domain's www + apex, plus the vercel.app URL). Passing an array to
  // cors reflects the request Origin only when it is in this allowlist.
  const allowedOrigins = webOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(auth));
  app.use('/api/users', createUsersRouter({ jwtAccessSecret: auth.jwtAccessSecret }));
  app.use('/api/employer', createEmployerRouter(employer));
  app.use('/api/jobs', createJobsRouter());

  // Global error handler. Without this, an error thrown in a route (e.g. a
  // failing Prisma query) becomes an unhandled promise rejection that crashes
  // the whole process — the client just sees a 502. Here we log the full error
  // server-side and return a clean JSON 500 with a short detail so failures are
  // diagnosable instead of fatal. Routes must forward async errors via
  // next(err) to reach this.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[api] unhandled error:', err);
    if (res.headersSent) return;
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    res.status(500).json({ error: 'internal_error', detail });
  });

  return app;
}
