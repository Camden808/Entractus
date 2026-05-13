import express, { type Express } from 'express';
import cors from 'cors';
import { createAuthRouter, type AuthRouterOptions } from './routes/auth.js';

export interface AppOptions {
  webOrigin: string;
  auth: AuthRouterOptions;
}

export function createApp({ webOrigin, auth }: AppOptions): Express {
  const app = express();

  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(auth));

  return app;
}
