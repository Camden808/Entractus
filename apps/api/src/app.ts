import express, { type Express } from 'express';
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

  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(auth));
  app.use('/api/users', createUsersRouter({ jwtAccessSecret: auth.jwtAccessSecret }));
  app.use('/api/employer', createEmployerRouter(employer));
  app.use('/api/jobs', createJobsRouter());

  return app;
}
