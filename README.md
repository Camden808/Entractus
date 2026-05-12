# Entractus Recruitment

Recruitment website for the Construction & Engineering industry. Employers can request recruiter services and post jobs; job seekers can search and filter open positions. Business users have an authenticated portal to manage their account.

See [`Requirements.md`](./Requirements.md) for the full product spec and [`Tasks.md`](./Tasks.md) for the implementation plan.

## Tech stack

- **Web** — React + TypeScript + Vite + Tailwind CSS (`apps/web`)
- **API** — Node.js + Express + TypeScript (`apps/api`)
- **Database** — PostgreSQL via Prisma ORM (local Postgres in Docker)
- **Auth** — JWT (short-lived access token + refresh token cookie)

## Repo layout

```
.
├── apps/
│   ├── web/   # Vite + React frontend
│   └── api/   # Express backend (Prisma added in task 1.3)
├── Requirements.md
├── Tasks.md
└── README.md  (this file)
```

This is an npm-workspaces monorepo. Run `npm install` once at the root and it installs both apps' dependencies.

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10 (ships with Node 20)
- **Docker Desktop** (for local Postgres, added in task 1.3)

## Quick start

```bash
# 1. Install dependencies for both apps
npm install

# 2. Copy env templates (edit values as needed)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Run web and api in two terminals
npm run dev:api      # http://localhost:3001
npm run dev:web      # http://localhost:5173
```

The API exposes a `/healthz` endpoint you can hit to confirm it's up:

```bash
curl http://localhost:3001/healthz
# {"status":"ok"}
```

## Available scripts (root)

| Script                 | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run dev:web`      | Start the Vite dev server for `apps/web`          |
| `npm run dev:api`      | Start the Express dev server for `apps/api` (tsx) |
| `npm run build:web`    | Type-check and build the web app                  |
| `npm run build:api`    | Compile the API to `apps/api/dist`                |
| `npm run lint`         | Run ESLint across both workspaces                 |
| `npm run typecheck`    | Run `tsc --noEmit` across both workspaces         |
| `npm run format`       | Format the repo with Prettier                     |
| `npm run format:check` | Check formatting without writing                  |

You can also target a single workspace, e.g. `npm run lint:api`, `npm run typecheck:web`.

## Environment variables

Each app has its own `.env.example`. Copy it to `.env` and fill in real values.

- **`apps/api/.env`** — `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, SMTP creds, `WEB_ORIGIN` (for CORS), `PORT`.
- **`apps/web/.env`** — `VITE_API_URL` pointing at the API.

`.env` files are gitignored. Never commit real secrets.

## Code style

- **TypeScript strict mode** is on in both apps (`strict`, `noUncheckedIndexedAccess`).
- **ESLint flat config** lives in each workspace (`apps/*/eslint.config.js`).
- **Prettier** is configured at the repo root (`.prettierrc.json`) so editors pick it up automatically. Run `npm run format` before committing.

## Workflow

Work proceeds through `Tasks.md` one task at a time. Each task is implemented on its own feature branch (`task/<n>-<slug>`) and merged via a pull request against `master`.
