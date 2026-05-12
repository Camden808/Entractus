import express from 'express';
import cors from 'cors';

const app = express();
const port = Number(process.env.PORT) || 3001;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

app.use(cors({ origin: webOrigin, credentials: true }));
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
