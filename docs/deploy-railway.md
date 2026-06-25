# Deploying the API to Railway (Task 11.2)

This runbook deploys `apps/api` (Node + Express + Prisma) to Railway. The web
app deploys separately to Vercel (Task 11.3).

## What's already wired up

- **`railway.json`** (repo root) drives the deploy:
  - `build`: `npm ci --include=dev && npm --workspace apps/api run build` (the
    build runs `prisma generate && tsc`, emitting `apps/api/dist`). The
    `--include=dev` is required because `prisma` and `typescript` are
    devDependencies, and Railway builds with `NODE_ENV=production` (which would
    otherwise skip them, so `tsc` would be "not found").
  - `startCommand`: `npm --workspace apps/api run start` → `node dist/index.js`.
  - `preDeployCommand`: `npm --workspace apps/api run db:migrate:deploy`
    (`prisma migrate deploy`) — applies migrations before each release.
  - `healthcheckPath`: `/healthz` — Railway waits for a 200 before routing
    traffic and rolling the release.
- The server binds `0.0.0.0` on `process.env.PORT` (Railway injects `PORT`).
- `/healthz` returns `{ "status": "ok" }`.

## Prerequisites

- Task 11.1 done: a **Postgres** service exists in your Railway project.
- The GitHub repo is pushed and you can log in to <https://railway.app>.

## Steps (Railway dashboard + GitHub)

1. **Open the project** that already contains the Postgres service from 11.1.
2. **Add the API service**: **New → GitHub Repo →** select this repository.
   Railway creates a service and detects `railway.json` at the repo root.
3. **Confirm the root directory** is `/` (the monorepo root) under
   **Service → Settings → Source**. The build/start commands target the
   `apps/api` workspace from the root, so the root must stay `/`.
4. **Set environment variables** (Service → **Variables**) — see the table
   below. For `DATABASE_URL`, click **Add Reference** and pick the Postgres
   service's `DATABASE_URL` so the two services stay linked
   (renders as `${{Postgres.DATABASE_URL}}`).
5. **Deploy.** Railway builds, runs the pre-deploy migration, starts the
   server, and probes `/healthz`. Watch **Deployments → View Logs**; you want
   to see `api listening on …` and a passing healthcheck.
6. **Expose it**: Service → **Settings → Networking → Generate Domain**. Note
   the URL, e.g. `https://entractus-api-production.up.railway.app`.
7. **Verify** (see below) that `/healthz` returns 200.
8. (Optional) **Seed** sample data once, from the service shell or locally with
   the prod `DATABASE_URL`: `npm --workspace apps/api run db:seed`.

### CLI alternative

```bash
npm i -g @railway/cli
railway login
railway link            # pick the project from step 1
railway up              # build + deploy from the current commit
railway domain          # generate / show the public domain
railway logs            # tail deploy + runtime logs
```

## Environment variables

| Variable                                                              | Required | Value / notes                                                                                                                                                                                                                              |
| --------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                        | ✅       | **Reference** the Postgres service variable (`${{Postgres.DATABASE_URL}}`).                                                                                                                                                                |
| `NODE_ENV`                                                            | ✅       | `production`                                                                                                                                                                                                                               |
| `WEB_ORIGIN`                                                          | ✅       | The deployed web origin for CORS, e.g. `https://entractus.com` (or the Vercel URL until the domain is live in Task 11.3 / §16).                                                                                                            |
| `WEB_BASE_URL`                                                        | ✅       | Same as `WEB_ORIGIN`; used to build password-reset links.                                                                                                                                                                                  |
| `JWT_ACCESS_SECRET`                                                   | ✅       | Long random string — `openssl rand -hex 64`.                                                                                                                                                                                               |
| `JWT_REFRESH_SECRET`                                                  | ✅       | A **different** long random string.                                                                                                                                                                                                        |
| `JWT_ACCESS_TTL`                                                      | ⬜       | Default `15m`.                                                                                                                                                                                                                             |
| `JWT_REFRESH_TTL`                                                     | ⬜       | Default `7d`.                                                                                                                                                                                                                              |
| `PASSWORD_RESET_TTL`                                                  | ⬜       | Default `1h`.                                                                                                                                                                                                                              |
| `EMPLOYER_NOTIFY_TO`                                                  | ⬜       | Default `contact@entractus.com` (employer-request notifications).                                                                                                                                                                          |
| `MAIL_FROM`                                                           | ⬜       | From-address for outbound mail.                                                                                                                                                                                                            |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | ⬜       | Real transactional SMTP. **Until these are set, in production the mailer falls back to log-only — password-reset and employer-notification emails are logged, not sent.** Finalized in §16 ("Configure production mailbox + SMTP sender"). |
| `PORT`                                                                | ⛔       | Do **not** set — Railway injects it.                                                                                                                                                                                                       |
| `UPLOAD_DIR`                                                          | ⬜       | Defaults to `./uploads`. ⚠️ Railway's filesystem is **ephemeral**: uploaded job-description files are lost on redeploy. For durable uploads, attach a Railway Volume or switch to S3 (the §4.2 optional path).                             |

## Verify `/healthz` returns 200

```bash
curl -i https://<your-railway-domain>/healthz
# HTTP/2 200
# {"status":"ok"}
```

Or check the response code only:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<your-railway-domain>/healthz
# 200
```

Once you've confirmed a 200 from the live URL, tick **Task 11.2** in
[`Tasks.md`](../Tasks.md) and record the API URL — Task 11.3 needs it for
`VITE_API_URL`, and you'll add this origin to the web app's config.

## Troubleshooting

- **Build fails with `tsc: not found` / exit code 240** — devDependencies
  (`prisma`, `typescript`) were skipped because Railway builds with
  `NODE_ENV=production`. The build command uses `npm ci --include=dev` to force
  them in; make sure you're deploying a commit that includes that fix.
- **Build fails on `prisma generate`** — ensure `DATABASE_URL` is set (Prisma
  reads it at generate/deploy time) and the Postgres reference resolves.
- **Healthcheck times out** — confirm the service didn't crash on boot
  (missing `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` throws at startup) and that
  `/healthz` is reachable; check **Deployments → View Logs**.
- **CORS errors from the browser** — `WEB_ORIGIN` must exactly match the web
  app's scheme + host (no trailing slash).
- **Migrations didn't apply** — the pre-deploy step runs `prisma migrate
deploy`; check its output in the deploy logs. It needs the same
  `DATABASE_URL`.
