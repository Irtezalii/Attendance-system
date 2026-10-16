# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

College student attendance system (students + professors). React SPA + Cloudflare Worker API + D1, all in one Worker. `README.md` has user-facing setup; `PROGRESS.md` tracks status and the next task. Update `PROGRESS.md` when a task is completed.

## Commands

- `npm run dev` — Vite dev server; the Cloudflare Vite plugin runs the Worker and local D1 in workerd with HMR.
- `npm test` — Vitest via `@cloudflare/vitest-plugin` (tests run inside workerd). Single test: `npx vitest run -t "name substring"`.
- `npm run lint` — ESLint. 2 "unused eslint-disable" warnings in generated `worker-configuration.d.ts` are expected.
- `npm run build` — `tsc -b` over all four tsconfig projects (app, node, worker, test), then `vite build`.
- `npm run db:migrate:local` / `db:seed:local` / `db:reset:local` — local D1. Local state in `.wrangler/state/v3/d1` is shared by `wrangler d1 execute --local` and `npm run dev`.
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc`.

## Architecture

- **Routing**: `wrangler.jsonc` sets `run_worker_first: ["/api/*"]` and SPA `not_found_handling`, so `/api/*` always hits the Worker and every other path serves the React app.
- **Worker** (`worker/`): Hono app with `basePath("/api")` in `worker/index.ts`; route groups in `worker/routes/{auth,student,faculty}.ts`. Errors are thrown as `HttpError` (`worker/lib/http.ts`) and turned into `{ error, details? }` JSON by `app.onError`.
- **Auth** (`worker/lib/auth.ts`): `requireAuth(role)` middleware loads the session (cookie token → SHA-256 → `sessions.id`) and sets `c.get("auth")` with `profileId` (= `students.id` or `faculty.id`). `csrfProtection` checks Origin/Sec-Fetch-Site and JSON content type on unsafe methods. Passwords are PBKDF2 in `worker/lib/password.ts`; `scripts/seed.mjs` must produce the same hash format.
- **Authorization rule**: every student query is scoped by `e.student_id = auth.profileId`; every faculty query goes through `getOwnedOffering` / `requireOwnedSession` (filter on `co.faculty_id`). Return 404 (not 403) for records outside the caller's scope. Keep this pattern for any new endpoint.
- **Attendance totals** are computed in SQL from `attendance_records` joined to `attendance_sessions` with `status = 'held'`. Nothing is stored denormalized. Percentage math lives in `shared/api.ts` (`summarize`, `attendancePercentage`).
- **Shared types**: `shared/api.ts` is the API contract, included by both the app and worker tsconfigs. Keep it type-only plus pure helpers.
- **Frontend** (`src/`): `react-router` v8 in library mode (`BrowserRouter` in `main.tsx`, routes in `App.tsx`). `src/lib/api.ts` is the fetch wrapper (dispatches a session-expired event on 401). `src/lib/useApi.ts` loads GET data. `src/lib/auth.tsx` is the auth context. Tailwind v4 via `@tailwindcss/vite`; there is no tailwind config file. Shared class strings live in `src/lib/styles.ts` (non-component exports must stay out of `.tsx` component files because of the react-refresh lint rule).
- **Database**: schema in `migrations/` (never edit an applied migration; add a new numbered file). D1 enforces foreign keys. A trigger guarantees a record's enrollment belongs to its session's offering. Completed semesters are read-only (enforced in `faculty.ts`).
- **Tests** (`test/`): `vitest.config.ts` reads `migrations/` and passes them as the `TEST_MIGRATIONS` binding. `test/apply-migrations.ts` applies them. `test/helpers.ts` seeds a small fixture and calls the Worker via `exports.default.fetch`.

## Gotchas

- `tsconfig.worker.json` overrides the inherited `nodenext` resolution with `bundler`. Worker imports have no `.js` suffixes.
- Workers caps PBKDF2 at 100,000 iterations. Don't raise it.
- `@cloudflare/vitest-pool-workers` is deprecated; this repo uses `@cloudflare/vitest-plugin` (`cloudflareTest()` plugin, `env`/`exports` from `cloudflare:workers`).
- `public/_headers` sets a strict CSP (`script-src 'self'`, `style-src 'self'`). Don't add inline scripts or `<style>` tags. React `style={{}}` props are fine.
- Real seed data goes in `scripts/data/` (gitignored). Never commit real student data or generated seed SQL.
