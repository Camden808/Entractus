# Deploying the web app to Vercel (Task 11.3)

This runbook deploys `apps/web` (Vite + React) to Vercel and wires it to the
Railway API from Task 11.2, then runs the end-to-end smoke test.

## What's already wired up

- **`apps/web/vercel.json`** — SPA fallback rewrite (`/(.*) → /index.html`).
  The app uses `createBrowserRouter` (real paths), so without this, refreshing
  or deep-linking to a route like `/jobs` would 404.
- **Cross-site auth** — the API sets the refresh cookie `SameSite=None; Secure`
  in production, so it works when the web app (`*.vercel.app`) and API
  (`*.up.railway.app`) are on different domains. (Handled in code; no action.)
- The build is `tsc -b && vite build`, output dir `dist`, env var `VITE_API_URL`.

## Prerequisites

- Task 11.2 done: the API is live (e.g. `https://entractus-production.up.railway.app`, `/healthz` → 200).
- The GitHub repo is pushed; you can log in to <https://vercel.com>.

## Steps

### 1. Create the Vercel project

1. **Add New… → Project →** import this GitHub repository.
2. **Root Directory:** set to **`apps/web`** (click "Edit" next to Root
   Directory). Vercel detects the npm workspace and installs from the repo root
   automatically.
3. **Framework Preset:** **Vite** (auto-detected). Leave Build Command
   (`npm run build`) and Output Directory (`dist`) at the Vite defaults.

### 2. Set the environment variable

Under **Settings → Environment Variables**, add (for Production, Preview, and
Development):

| Variable       | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| `VITE_API_URL` | `https://entractus-production.up.railway.app` (no trailing slash) |

> ⚠️ `VITE_*` vars are **inlined at build time**. If you change `VITE_API_URL`
> later, you must **redeploy** for it to take effect.

### 3. Deploy

Click **Deploy**. When it finishes, note the production URL, e.g.
`https://entractus-web.vercel.app`.

### 4. Point the API's CORS at the Vercel origin

On the **Railway API service → Variables**, set these to the Vercel URL (exact
scheme + host, **no trailing slash**), then let it redeploy:

| Variable       | Value                              |
| -------------- | ---------------------------------- |
| `WEB_ORIGIN`   | `https://entractus-web.vercel.app` |
| `WEB_BASE_URL` | `https://entractus-web.vercel.app` |

`WEB_ORIGIN` is the CORS allowlist (with credentials); `WEB_BASE_URL` is used
for links in password-reset emails.

### 5. Seed the production database (for the smoke test)

The smoke test needs sample job postings and an admin account. Run the seed
once against the prod database — from the Railway API service shell, or locally
with the prod `DATABASE_URL`:

```bash
npm --workspace apps/api run db:seed
```

(Note the seeded admin credentials from `apps/api/prisma/seed.ts` so you can log
in as admin.)

## End-to-end smoke test (Task 11.3 acceptance)

On the live Vercel URL, walk the critical path:

1. **Register** a new account → you land logged in.
2. **Log out and log back in** → session persists across a refresh (this
   exercises the cross-site refresh cookie).
3. **Submit the employer contact form** (`/contact`) → success state.
4. **Browse the job gallery** (`/jobs`) → seeded postings render; search +
   filters work.
5. **Admin:** log in as the seeded admin → `/admin/jobs` → **create** a posting
   → it appears in the gallery.

If all five pass, tick **Task 11.3** in [`Tasks.md`](../Tasks.md).

## Known caveats (fine for the smoke test)

- **Emails are log-only in prod** until SMTP is configured (§16) — password
  reset + employer-request notifications are logged, not delivered.
- **Uploads are ephemeral** on Railway — job-description files are lost on
  redeploy until a Volume or S3 is added (§4.2 optional path).

## Troubleshooting

- **404 on refresh / deep link** — the SPA rewrite isn't active; confirm
  `apps/web/vercel.json` deployed and Root Directory is `apps/web`.
- **CORS error in the browser console** — `WEB_ORIGIN` on the API must exactly
  match the Vercel origin (scheme + host, no trailing slash); redeploy the API
  after changing it.
- **Login works but you're logged out on refresh** — the cross-site refresh
  cookie was blocked. Confirm the API is on HTTPS (Secure) and CORS is set with
  credentials (it is: `credentials: true`), and `WEB_ORIGIN` matches exactly.
- **`VITE_API_URL` seems wrong / calls go to localhost** — it was missing at
  build time; set it and redeploy (it's inlined at build).
- **Empty job gallery** — the prod database wasn't seeded (step 5).
