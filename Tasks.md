# Entractus Recruitment — Implementation Tasks

Tasks are grouped into phases and ordered roughly by dependency. Each item is sized at ~½–1 day for an intermediate developer. Tick boxes as you complete work.

---

## 1. Project Setup

- [x] **Initialize repo structure** — Create a monorepo (`apps/web` for React+Vite+TS+Tailwind, `apps/api` for Node+Express+TS) or two sibling repos. Pick whichever you'll deploy more easily.
- [x] **Configure shared tooling** — ESLint, Prettier, TypeScript strict mode, `.env.example`, `.gitignore`, and a top-level README describing how to run web + api locally.
- [x] **Set up local Postgres + Prisma** — Add a `docker-compose.yml` for local Postgres. Run `prisma init` in `apps/api`, point `DATABASE_URL` at the local DB, verify `prisma migrate dev` works on an empty schema.

## 2. Database & Prisma Schema

- [x] **Define Prisma models** — Translate Requirements.md into models: `User` (id, email unique, company, password_hash, display_name, timezone, role, created_at), `EmployerRequest` (the Company Information form fields + uploaded job description file path), `Industry` (id, user_id nullable, client boolean), `JobPosting` (id, title, state, city, type, company, posted_date, description, created_by). Run initial migration.
- [x] **Seed script** — Create `prisma/seed.ts` that seeds a few system-default `Industry` rows, one admin `User`, and ~5 sample `JobPosting` rows so the frontend has data to render.

## 3. Backend — Authentication

- [x] **Register + login endpoints** — Implement `POST /api/auth/register` and `POST /api/auth/login` with Zod request validation, bcrypt password hashing, and JWT issuance (short-lived access token + longer-lived refresh token stored as httpOnly cookie).
- [x] **Refresh + logout endpoints** — Implement `POST /api/auth/refresh` (rotate refresh token, issue new access token) and `POST /api/auth/logout` (clear refresh cookie, invalidate token via DB-backed revocation list or jti).
- [x] **Password reset flow** — Implement `POST /api/auth/forgot-password` (generate single-use token, email reset link via Nodemailer — use Ethereal in dev, configurable SMTP in prod) and `POST /api/auth/reset-password` (verify token, update password_hash).

## 4. Backend — Users & Employer Requests

- [x] **User account endpoints** — Implement `GET /api/users/me`, `PATCH /api/users/me` (update display_name, timezone), `DELETE /api/users/me` (cascade-delete user's owned data). All behind a JWT auth middleware.
- [x] **Employer request endpoints** — Implement `POST /api/employer/request` (public; validates and stores the contact form payload, accepts optional file upload via Multer to local disk or S3) and `POST /api/employer/signup` (converts an employer request into a `User` account).
- [x] **Contact email + employer-request notification** — Use `contact@entractus.com` as the "Email Us" address in the global navigation (`GlobalNav.tsx`), replacing the `hello@entractus.example` placeholder. When an employer submits the Contact form (`POST /api/employer/request` from `ContactPage.tsx`), send a notification email to `contact@entractus.com` (via the existing `apps/api/src/mail/mailer.ts`) containing every field submitted — contact name, company, address, city, phone, email, position title, position type, hours, duties & responsibilities, additional questions, and a link/attachment for the uploaded job description. Set `reply-to` to the submitter's email. Send after the record is stored so a mail failure doesn't fail the request; add a test asserting the mailer is invoked with the form data.

## 5. Backend — Job Postings

- [x] **Public job listings endpoint** — Implement `GET /api/jobs` with query params for search (`q` on title), filters (`state`, `city`, `type`, `company`), and pagination (`page`, `pageSize`). Return total count + items.
- [x] **Admin job posting endpoints** — Implement `POST /api/employer/post` (create), `PATCH /api/employer/post/:id` (edit), `POST /api/employer/delete` (delete by id). Gate all three behind an admin-role JWT middleware.

## 6. Frontend — Foundation

- [x] **Routing + global layout** — Set up `react-router` routes for all screens listed in Requirements.md. Build a `<Layout>` with header/footer and Tailwind theme tokens (brand colors, font stack, spacing scale).
- [x] **Global navigation component** — Build the nav: Hire Employees button, Job Openings button, Email-us and Phone-us buttons, plus a dropdown with For Employers / For Job Seekers / About / Blog / Contact Us. Make it responsive (mobile hamburger).
- [x] **Shared primitives + API client** — Build reusable form components (Input, Select, Textarea, FileDropzone, Button) and an `apiClient` wrapper (fetch-based or axios) that injects the JWT access token and auto-refreshes on 401.

## 7. Frontend — Public Pages

- [x] **Landing / Main page** — Hero banner with business imagery, headline copy, CTAs linking to Job Openings and the employer contact form.
- [x] **Employers page** — Static page with the "Recruitment Service Request" copy from Requirements.md, the bulleted reasons-clients-hire-us list, and a "Contact Us Today" CTA that routes to the Contact page.
- [x] **Contact page (employer form)** — Build the full form: Contact Name (first/last), Company Name, Company Address, City, Phone, Email, Position Title, Position Type (Temporary / Temp To Perm / Direct Hire), Hours (Full Time / Part Time), Duties & Responsibilities, file drag-drop for job description, additional questions textarea. Validate client-side and POST to `/api/employer/request`. Show success + error states.
- [x] **About + Blog placeholder pages** — Static About page with company copy; Blog page renders a stubbed post list (can be hard-coded for now) so navigation links resolve.

## 8. Frontend — Job Openings

- [x] **Job gallery component** — Card grid showing Job Title, State/City, Type, Company, Posted Date. Include loading skeleton, empty state, and error state. Fetch from `GET /api/jobs`.
- [x] **Search + filter controls** — Search input (debounced) and filter dropdowns (state, city, type, company). Wire to the same `GET /api/jobs` endpoint via query params. Sync filter state to URL so links are shareable.

## 9. Frontend — Auth & Account Portal

- [x] **Auth screens** — Build Login, Register, Forgot Password, and Reset Password pages with form validation and error display. Persist tokens via the apiClient.
- [x] **Account portal page** — Authenticated route showing profile fields (email, display_name, timezone), edit form, change-password form, and a destructive "Delete account" action with confirmation. Link from the global nav when logged in.

## 10. Admin — Job Posting Management

- [x] **Admin role + route gating** — Add `role` enum (`user` | `admin`) to the `User` model and migration. Seed an initial admin. Add backend admin-only middleware and frontend route guard that redirects non-admins.
- [x] **Admin job posting UI** — Admin-only page listing all postings with create, edit, and delete actions. Form fields match the `JobPosting` model. Wire to the admin endpoints from §5.

## 11. Deployment & Hosting

- [x] **Provision managed Postgres** — Create a Postgres instance on Railway. Set `DATABASE_URL` secret. Run `prisma migrate deploy` against it from CI or locally.
- [ ] **Deploy API** — Deploy `apps/api` to Railway or Render. Configure env vars (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, SMTP creds, `WEB_ORIGIN` for CORS). Expose a `/healthz` endpoint and confirm it returns 200.
- [ ] **Deploy frontend + verify end-to-end** — Deploy `apps/web` to Vercel with `VITE_API_URL` pointing at the deployed API. Configure CORS on the API to allow the Vercel origin. Smoke-test: register → log in → submit employer form → browse job gallery → admin can create a posting.

## 12. Continuous Integration & Delivery

- [ ] **CI pipeline** — Add a GitHub Actions workflow that runs on every PR and push to `master`: `npm ci`, then `npm run test`, `npm run typecheck`, `npm run lint`, and `npx prettier --check .` across both workspaces. Spin up a Postgres service container so API tests have a database. Make the checks required for merge.
- [ ] **Automated migrations + deploy** — Extend CI/CD so merges to `master` run `prisma migrate deploy` against the managed Postgres, then trigger the API (Railway/Render) and web (Vercel) deployments. Gate deploy on the test job passing; surface deploy status back to the PR.

## 13. End-to-End Testing

- [ ] **Playwright setup** — Add Playwright to the repo with a config that boots web + api against an ephemeral test database, plus a root `npm run test:e2e` script and a CI job that runs it headless. Seed deterministic fixtures (admin user, sample postings) before each run.
- [ ] **E2E smoke flows** — Write end-to-end specs for the critical paths: register → log in → submit the employer contact form, browse + filter the job gallery, account portal edit/delete, and admin create/edit/delete of a job posting. Assert on visible UI state and key API responses.

## 14. Accessibility & SEO

- [ ] **Accessibility audit** — Pass an automated a11y check (axe via `@axe-core/playwright` or Lighthouse) on every public page. Fix violations: semantic landmarks, labelled form controls, focus order, keyboard navigation for the nav dropdown + mobile hamburger, color-contrast against the brand tokens, and visible focus rings.
- [ ] **SEO + metadata** — Add per-route `<title>`/meta description (react-helmet or equivalent), Open Graph + Twitter card tags, favicon/social images, a generated `sitemap.xml` and `robots.txt`, and structured data (JobPosting schema.org) on job listings. Verify a Lighthouse SEO score of 100.

## 15. Monitoring & Analytics

- [ ] **Error tracking + logging** — Wire Sentry (or equivalent) into both apps for client + server error capture with source maps. Add structured request logging (pino) on the API and a `/healthz` readiness check covering DB connectivity.
- [ ] **Analytics + uptime monitoring** — Add privacy-friendly web analytics (Plausible/Umami) to the frontend and an uptime monitor (e.g. Better Stack/UptimeRobot) hitting `/healthz` with alerting on failure. Document where dashboards live.

## 16. Production Domain

- [ ] **Deploy site to Entractus.com** — Domain is registered at **GoDaddy** (registrar only — GoDaddy's PHP/cPanel shared hosting can't run the Node/Express API or Postgres, so the app is *not* hosted there). In GoDaddy's DNS, point the `entractus.com` apex + `www` records at the Vercel frontend and an `api.entractus.com` CNAME at the API host (Railway/Render). Provision TLS certificates, force HTTPS + www→apex (or apex→www) redirects, update `VITE_API_URL`, `WEB_ORIGIN`, and CORS allowlist to the production domains, and re-run the end-to-end smoke test against the live site.
- [ ] **Configure production mailbox + SMTP sender** — Stand up a real `contact@entractus.com` mailbox (GoDaddy/Microsoft 365 email, Google Workspace, or equivalent) so the address used by the "Email Us" nav link and the employer-request notification (§4) can both send and receive. Set up a transactional SMTP sender for the API (e.g. Resend/Postmark/SendGrid, or the mailbox provider's SMTP), and configure the prod env vars (SMTP host/port/user/pass, from-address `contact@entractus.com`) — replacing the dev Ethereal transport. Add SPF, DKIM, and DMARC DNS records in GoDaddy so outbound mail isn't flagged as spam, then send a live test through the Contact form and confirm the notification arrives at the real inbox.

---

**Total: 41 tasks.** Work top-to-bottom; phases 3–5 (backend) and 6 (frontend foundation) can be parallelized once §1 and §2 are done. Phases 12–16 are production-hardening and can begin once the core app (§1–§11) is deployable.
