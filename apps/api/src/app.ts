import express, { type Express } from 'express';
import cors from 'cors';

export interface AppOptions {
  webOrigin: string;
}

export function createApp({ webOrigin }: AppOptions): Express {
  const app = express();

  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
