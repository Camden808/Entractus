# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Entractus Recruitment is a recruitment-services website for the Construction & Engineering industry. The source of truth for _what_ to build is [`Requirements.md`](./Requirements.md) (product spec — screens, data models, API endpoints). The source of truth for _what to build next_ is [`Tasks.md`](./Tasks.md) — 28 checkboxes across 11 phases, ordered by dependency. Read both before starting non-trivial work.

## Repo layout

npm workspaces monorepo. `npm install` at the root installs everything.

- `apps/web/` — Vite + React 19 + TypeScript + Tailwind CSS 4
- `apps/api/` — Node + Express + TypeScript + Prisma 5 (Postgres)
- `docker-compose.yml` — local Postgres (postgres:16-alpine)
- Root configs: `.prettierrc.json`, `.prettierignore`, `.gitattributes`, `tsconfig`-less (each app owns its own)

## Workflow

Work moves through `Tasks.md` one item at a time. **Every task gets its own branch and pull request** — never commit directly to `master`. See the [Git Workflow](#git-workflow) section below for branch naming and commit conventions. Land via `gh pr merge <N> --squash --delete-branch` and re-branch off updated `master`.

When a task lands, tick its checkbox in `Tasks.md` as part of the same PR.

## Common commands

Run from the repo root unless noted otherwise.

| Command                                   | Purpose                                                |
| ----------------------------------------- | ------------------------------------------------------ |
| `npm run dev:api`                         | Express dev server (tsx watch) — http://localhost:3001 |
| `npm run dev:web`                         | Vite dev server — http://localhost:5173                |
| `npm run db:up` / `npm run db:down`       | Start / stop the local Postgres container              |
| `npm run db:migrate`                      | Apply Prisma migrations (dev workflow)                 |
| `npm run db:studio`                       | Prisma Studio in the browser                           |
| `npm run test`                            | Vitest run in both workspaces (5 api + 4 web today)    |
| `npm run test:api` / `npm run test:web`   | Single-workspace test run                              |
| `npm run test:coverage`                   | v8 coverage in both workspaces                         |
| `npm run typecheck`                       | `tsc --noEmit` in both workspaces                      |
| `npm run lint`                            | ESLint across both workspaces                          |
| `npm run format` / `npm run format:check` | Prettier write / verify                                |

### Running a single test or test name

Vitest doesn't run from the root by name — go into the workspace:

```bash
npm --workspace apps/api exec -- vitest run src/app.test.ts
npm --workspace apps/web exec -- vitest run src/App.test.tsx
npm --workspace apps/api exec -- vitest run -t "returns 200"   # filter by test name
```

`test:watch` is per-workspace (`npm --workspace apps/web run test:watch`).

### Database reset

```bash
docker compose down -v   # also deletes the named volume
npm run db:up
npm run db:migrate
```

## Architecture decisions worth knowing

**API app factory.** `apps/api/src/index.ts` is _only_ an entrypoint — it reads env and calls `app.listen`. The actual Express wiring lives in [`apps/api/src/app.ts`](apps/api/src/app.ts) and is exported as `createApp({ webOrigin })`. Tests import the factory and use supertest in-process; nothing binds a port. Keep this split when adding routes — put middleware/routes in `app.ts`, never in `index.ts`.

**Vitest pool on web is `threads`, not `forks`.** Vitest v4 defaults to `forks`, but on Windows the project path "Entractus Recruitment" (with a space) causes the forks worker URL to URL-encode incorrectly and time out. `apps/web/vitest.config.ts` explicitly sets `pool: 'threads'`. Don't change this without testing on Windows.

**Line endings are LF, enforced two ways.** `.gitattributes` has `* text=auto eol=lf`, and Prettier's `endOfLine: "lf"` matches. Without this, Git's autocrlf on Windows converts to CRLF on checkout and `prettier --check` fails. If you touch any text file outside Prettier's pipeline, ensure it stays LF.

**Prisma schema conventions.** [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) uses camelCase field names with `@map` to snake_case DB columns; tables use `@@map` to snake_case as well (e.g. `users`, `job_postings`). UUID primary keys (`@db.Uuid`, `@default(uuid())`) — generated client-side, no Postgres extension required. Cascade deletes on user-owned tables (Industry, JobPosting) so the §4 "delete account removes all data" requirement is straightforward. When you change models, run `npm --workspace apps/api exec -- prisma migrate dev --name <descriptive_name>` to generate the next migration; commit the updated schema + the new migration folder together.

**TypeScript strict mode is on everywhere.** Both apps have `strict: true` and `noUncheckedIndexedAccess: true`. Indexed access returns `T | undefined` — assertions on Vitest mock call args generally need `as unknown as [...]` to satisfy this. See `apps/web/src/main.test.tsx` for the pattern.

**API uses ESM with NodeNext.** Relative imports in `apps/api/src` must end in `.js` (e.g. `import { createApp } from './app.js'`) even though the source files are `.ts`. The TS compiler + Vitest both resolve this correctly. The web app's bundler config does not require this.

**No CI yet, no E2E yet.** Both come later (§11 Deployment for CI, after §6 for Playwright). Until then, every PR is verified locally via `npm run test && npm run typecheck && npm run lint && npx prettier --check .`.

## Environment

- **Node.js ≥ 20** (npm 10+ ships with it).
- **Docker Desktop** is required for the local Postgres. The daemon must be running before `npm run db:up`.
- Each app needs its own `.env` (copy from `.env.example`). `apps/api/.env` holds `DATABASE_URL`, JWT secrets, SMTP creds, `WEB_ORIGIN`, `PORT`; `apps/web/.env` holds `VITE_API_URL`. `.env` files are gitignored.

## Conventions to follow

- One concern per PR. The PR title is `Task <n>: <short description>` (e.g. `Task 2.1: Define Prisma models`). PR body has a Summary and a Test plan.
- When a script fits a category, prefer adding it to the root `package.json` as a forwarder (`npm --workspace apps/<x> run <script>`) so the root surface stays self-documenting.
- New API tests use supertest against `createApp(...)`. New web tests use RTL with the setup in `apps/web/src/test/setup.ts` (jest-dom matchers + RTL cleanup are already wired).
- `Tasks.md` and `Requirements.md` are authored documents — don't reformat them with Prettier (they're in `.prettierignore`).

## Git Workflow

When completing tasks from `Tasks.md`:

1. Create a new branch named `feature/<task-number>-<brief-description>` before starting work.
2. Make atomic commits with conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `refactor:` for refactoring
3. After completing a task, create a pull request with:
   - A descriptive title matching the task
   - A summary of changes made
   - Any testing notes or considerations
4. Update the task checkbox in `Tasks.md` to mark it complete.

## Testing Requirements

Before marking any task as complete:

1. Write unit tests for the new functionality.
2. Run the full test suite with `npm run test`.
3. If tests fail:
   - Analyze the failure output.
   - Fix the code (not the tests, unless the tests are incorrect).
   - Re-run tests until all pass.
4. For API endpoints, include integration tests that verify:
   - Success responses with valid input
   - Authentication requirements
   - Edge cases (validation errors, conflicts, missing fields)

## Test Commands

The repo uses npm workspaces with Vitest in both apps. See "Common commands" above for the full table; the most useful test-specific recipes:

- Run all tests: `npm run test`
- Backend (api) tests only: `npm run test:api`
- Frontend (web) tests only: `npm run test:web`
- Specific test file: `npm --workspace apps/api exec -- vitest run src/routes/auth.test.ts`
- Filter by test name: `npm --workspace apps/api exec -- vitest run -t "returns 400"`
- Watch mode (per workspace): `npm --workspace apps/api run test:watch`
