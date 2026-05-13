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
│   └── api/   # Express backend + Prisma ORM
├── docker-compose.yml  # Local Postgres
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

# 3. Start local Postgres in Docker
npm run db:up

# 4. Apply Prisma migrations (creates the database schema)
npm run db:migrate

# 5. Run web and api in two terminals
npm run dev:api      # http://localhost:3001
npm run dev:web      # http://localhost:5173
```

The API exposes a `/healthz` endpoint you can hit to confirm it's up:

```bash
curl http://localhost:3001/healthz
# {"status":"ok"}
```

## Database

Postgres runs in Docker via `docker-compose.yml`. The `apps/api/.env.example` `DATABASE_URL` matches the compose file's credentials, so the default config "just works" once `npm run db:up` is running.

| Script               | What it does                                                             |
| -------------------- | ------------------------------------------------------------------------ |
| `npm run db:up`      | Start the local Postgres container (detached, with healthcheck)          |
| `npm run db:down`    | Stop the Postgres container (data is preserved in the named volume)      |
| `npm run db:migrate` | Apply pending Prisma migrations and regenerate the client (dev workflow) |
| `npm run db:studio`  | Open Prisma Studio in the browser to inspect data                        |

To wipe local data and start fresh:

```bash
docker compose down -v   # stops the container AND removes its named volume
npm run db:up
npm run db:migrate
```

Prisma's schema lives at [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma). Models are added incrementally as backend tasks land.

## Available scripts (root)

| Script                 | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run dev:web`      | Start the Vite dev server for `apps/web`          |
| `npm run dev:api`      | Start the Express dev server for `apps/api` (tsx) |
| `npm run build:web`    | Type-check and build the web app                  |
| `npm run build:api`    | Compile the API to `apps/api/dist`                |
| `npm run db:up`        | Start local Postgres in Docker                    |
| `npm run db:down`      | Stop local Postgres                               |
| `npm run db:migrate`   | Apply Prisma migrations against local Postgres    |
| `npm run db:studio`    | Open Prisma Studio                                |
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

## Testing

Both workspaces use **[Vitest](https://vitest.dev)** as the test runner. The API uses **supertest** for in-process integration tests against the Express app; the web uses **React Testing Library** + jsdom for component tests.

| Script                  | What it does                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `npm run test`          | Run all tests in both workspaces (one-shot, CI-friendly)     |
| `npm run test:api`      | Run only the API test suite                                  |
| `npm run test:web`      | Run only the web test suite                                  |
| `npm run test:coverage` | Run with v8 coverage; output goes to `apps/<name>/coverage/` |

Within a workspace, `npm run test:watch` keeps Vitest open in watch mode.

Tests live alongside the source they cover (e.g. `apps/api/src/app.test.ts`, `apps/web/src/App.test.tsx`). Database-backed integration tests will land alongside Prisma models (§2.1 onward).

## Code style

- **TypeScript strict mode** is on in both apps (`strict`, `noUncheckedIndexedAccess`).
- **ESLint flat config** lives in each workspace (`apps/*/eslint.config.js`).
- **Prettier** is configured at the repo root (`.prettierrc.json`) so editors pick it up automatically. Run `npm run format` before committing.

## Workflow

Work proceeds through `Tasks.md` one task at a time. Each task is implemented on its own feature branch (`task/<n>-<slug>`) and merged via a pull request against `master`.
