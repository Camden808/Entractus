import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3001;
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

const app = createApp({ webOrigin });

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
