# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

KU/UBIT (University of Karachi, Department of Computer Science) student attendance system for students and professors. React SPA + Cloudflare Worker API + D1, all in one Worker. `README.md` has user-facing setup; `PROGRESS.md` tracks status and the next task. Update `PROGRESS.md` when a task is completed.

## Commands

- `npm run dev` — Vite dev server; the Cloudflare Vite plugin runs the Worker and local D1 in workerd with HMR.
- `npm test` — Vitest via `@cloudflare/vitest-plugin` (tests run inside workerd). Single test: `npx vitest run -t "name substring"`.
- `npm run lint` — ESLint. 2 "unused eslint-disable" warnings in generated `worker-configuration.d.ts` are expected.
- `npm run build` — `tsc -b` over all four tsconfig projects (app, node, worker, test), then `vite build`.
- `npm run db:setup:local` — migrations, curriculum import, faculty directory import, dev seed. `db:reset:local` wipes local D1 first and fails while `npm run dev` holds the files.
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` after changing bindings in `wrangler.jsonc`.
- Testing against a separate local DB without touching `.wrangler/state`: `wrangler d1 ... --local --persist-to <dir>` plus `wrangler dev -c dist/attendance_system/wrangler.json --persist-to <dir>` after `npm run build`.

## Architecture

- **Routing**: `wrangler.jsonc` sets `run_worker_first: ["/api/*"]` and SPA `not_found_handling`, so `/api/*` always hits the Worker and every other path serves the React app.
- **Worker** (`worker/`): Hono app with `basePath("/api")` in `worker/index.ts`. Route groups are in `worker/routes/{auth,student,faculty}.ts`. Errors are thrown as `HttpError` (`worker/lib/http.ts`) and turned into `{ error, details? }` JSON by `app.onError`.
- **Auth** (`worker/lib/auth.ts`):
  - `requireAuth(role)` loads the session (cookie token → SHA-256 → `sessions.id`) and sets `c.get("auth")` with `profileId` (= `students.id` or `faculty.id`).
  - The cookie is `__Host-sid` over HTTPS and `sid` over HTTP.
  - Faculty sign-in also requires `faculty.status = 'active'`.
  - `csrfProtection` checks Origin/Sec-Fetch-Site and JSON content type on unsafe methods.
  - Passwords are PBKDF2 in `worker/lib/password.ts`. `scripts/seed.mjs` and `scripts/grant-faculty-access.mjs` must produce the same hash format.
- **Authorization rule**: every student query is scoped by `e.student_id = auth.profileId`. Every faculty query goes through `getOwnedOffering` / `requireOwnedSession` (filter on `co.faculty_id`). Return 404 (not 403) for records outside the caller's scope. Keep this pattern for any new endpoint.
- **Attendance totals** are computed in SQL from `attendance_records` joined to `attendance_sessions` with `status = 'held'`. Nothing is stored denormalized. Percentage math lives in `shared/api.ts`. Rosters and marking use only `enrollments.status = 'enrolled'`.
- **Academic model** (`migrations/0002_academic_structure.sql`):
  - `programmes` (BSCS/BSSE/BSAI).
  - `curricula` + `curriculum_courses`: definitions. A row is a course, or an elective slot with a placeholder code (`CS-xxx`) linked by `elective_group`; `alternative_group` marks one-of options such as Project/Thesis.
  - `course_offerings`: what is taught in a `semesters` row (number × academic year). Enrollments and attendance hang off offerings, never off curriculum rows.
  - `faculty` is a directory profile. `user_id` is NULL unless access was granted.
  - Morning/Evening (`migrations/0003_shifts.sql`): `course_offerings.shift` and `students.shift`. A course taught in both schedules is two offerings, unique on (course, semester, shift, section). Triggers reject enrollments whose student shift or programme doesn't match the offering. An offering's programme is derived from the curriculum (`OFFERING_COLUMNS.programme_code`).
- **Data pipeline** (no HTTP admin/seed endpoints, by design):
  - `data/curriculum/*.json` → `scripts/import-curriculum.mjs`. This also regenerates `docs/curriculum-validation.md`, so commit both together.
  - `data/faculty/*.json` → `scripts/import-faculty.mjs`, which never creates logins.
  - `scripts/grant-faculty-access.mjs` grants or revokes access for one profile.
  - `scripts/seed.mjs` loads accounts, semesters, offerings, and enrollments. It validates course codes against `data/curriculum` before writing SQL.
  - All of these emit idempotent SQL for `wrangler d1 execute --file`.
- **Shared types**: `shared/api.ts` is the API contract, included by both the app and worker tsconfigs. Keep it type-only plus pure helpers.
- **Frontend** (`src/`):
  - `react-router` v8 in library mode; routes are in `App.tsx`, and role-based nav lives in `components/Layout.tsx`.
  - `src/lib/api.ts` is the fetch wrapper; it dispatches a session-expired event on 401, and the login page shows a notice. `src/lib/useApi.ts` loads GET data.
  - Branding (names, logo/background paths) is in `src/lib/branding.ts`. Design tokens (`ku-maroon-*`, `ku-navy-*`, `ku-gold-*`, serif/sans fonts) are in `src/index.css` `@theme`.
  - Shared class strings are in `src/lib/styles.ts`. Non-component exports must stay out of `.tsx` component files because of the react-refresh lint rule.
- **Tests** (`test/`): `vitest.config.ts` reads `migrations/` into the `TEST_MIGRATIONS` binding, and `test/apply-migrations.ts` applies them. `test/helpers.ts` seeds a small fixture and calls the Worker via `exports.default.fetch`.

## Gotchas

- **Rebuilding a referenced table in a D1 migration**: use `PRAGMA defer_foreign_keys = true`, copy the rows out, create the new table, drop the old one, rename, and **then** re-insert the rows. Inserting before the rename leaves deferred FK violations, and D1 reports that as an opaque "internal error". See migration 0002. Never edit an applied migration.
- Global element styles in `src/index.css` must stay inside `@layer base`, or they override Tailwind utilities.
- `tsconfig.worker.json` overrides the inherited `nodenext` resolution with `bundler`. Worker imports have no `.js` suffixes.
- Workers caps PBKDF2 at 100,000 iterations. Don't raise it.
- `public/_headers` sets a strict CSP (`script-src 'self'`, `style-src 'self'`, fonts self-hosted via `@fontsource-variable`). Don't add inline scripts, `<style>` tags or external font/CDN URLs. React `style={{}}` props are fine.
- Curriculum and faculty JSON preserve source values as published. Record doubts in `sourceIssues` / `notes` instead of "fixing" codes or credits.
- Real seed data goes in `scripts/data/` (gitignored). Never commit real student data, passwords or generated seed SQL.
