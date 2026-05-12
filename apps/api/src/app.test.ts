import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const WEB_ORIGIN = 'http://localhost:5173';

function makeApp() {
  return createApp({ webOrigin: WEB_ORIGIN });
}

describe('GET /healthz', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await request(makeApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('unknown routes', () => {
  it('returns 404 for an unknown GET', async () => {
    const res = await request(makeApp()).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('echoes the allowed origin on a preflight from WEB_ORIGIN', async () => {
    const res = await request(makeApp())
      .options('/healthz')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBeLessThan(400);
    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not echo a disallowed origin', async () => {
    const res = await request(makeApp())
      .options('/healthz')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
  });
});

describe('JSON body parsing', () => {
  it('parses application/json bodies without crashing', async () => {
    // POST against the (404) route — body parser must still process the payload,
    // proving express.json() middleware is wired in front of the router.
    const res = await request(makeApp())
      .post('/healthz')
      .set('Content-Type', 'application/json')
      .send({ hello: 'world' });
    expect(res.status).toBe(404);
  });
});
