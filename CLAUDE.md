# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

KU/UBIT student attendance system: React SPA + Hono Worker API + D1 in one Cloudflare Worker. Setup is in `README.md`; status is in `PROGRESS.md` (update it when a task is done).

## Commands
- `npm run dev`: Vite + Worker + local D1 with HMR. Restart it after editing `wrangler.jsonc`.
- `npm test`: Vitest inside workerd. Run a single test with `npx vitest run -t "name"`.
- `npm run lint`: the 2 warnings in `worker-configuration.d.ts` are expected.
- `npm run build`: `tsc -b` (app, node, worker, test), then `vite build`.
- `npm run db:setup:local`: migrations, curriculum, faculty and dev seed. `db:reset:local` wipes D1 first and fails while dev is running.
- `npm run cf-typegen`: run after changing bindings or vars.
- Isolated local DB: `wrangler d1 ... --local --persist-to <dir>` and `wrangler dev -c dist/attendance_system/wrangler.json --persist-to <dir>`.

## Architecture
- `run_worker_first: ["/api/*"]`: the Worker serves `/api`, and everything else falls through to the SPA.
- **Worker**: `worker/index.ts` mounts `routes/{auth,student,faculty}.ts`; `faculty.ts` also mounts `routes/live.ts`. Throw `HttpError`, which `onError` turns into `{ error, details? }`.
- **Auth** (`lib/auth.ts`): `requireAuth(role)` sets `c.get("auth")`, where `profileId` = `students.id` or `faculty.id`. The cookie is `__Host-sid` on HTTPS and `sid` on HTTP. CSRF requires an Origin check and a JSON body. Passwords use PBKDF2 (keep the format in sync with `scripts/seed.mjs` and `grant-faculty-access.mjs`).
- **Authorization**: scope student queries by `e.student_id = auth.profileId`. Faculty access goes through `requireOwnedOffering` / `requireOwnedSession` (`lib/ownership.ts`, `faculty.ts`). Out-of-scope requests get 404.
- **Attendance totals**: computed in SQL from records joined to sessions with `status = 'held'`. Never stored. Math is in `shared/api.ts`. Rosters use `enrollments.status = 'enrolled'`.
- **Schema** (`migrations/`):
  - 0002: `programmes`, `curricula`/`curriculum_courses` (definitions only), and `faculty` directory profiles (`user_id` NULL means no login).
  - 0003: `shift` on offerings and students. Unique on (course, semester, shift, section). Triggers block cross-shift and cross-programme enrollment. An offering's programme is derived from the curriculum.
  - 0004: live codes on `attendance_sessions`. START inserts the class plus Absent records. Check-in is a single conditional `UPDATE` to Present. Expiry is timestamp-based (`code_expires_at > now`). Partial unique indexes allow one active code per offering and per code. `CHECKIN_LIMITER` limits attempts and `APP_TIMEZONE` sets dates.
- **Data pipeline** (no HTTP admin endpoints): `scripts/import-curriculum.mjs` (also regenerates `docs/curriculum-validation.md`), `import-faculty.mjs` (never creates logins), `grant-faculty-access.mjs`, and `seed.mjs` (validates codes, programme and shift). All emit idempotent SQL.
- **Frontend**: react-router v8. Routes are in `App.tsx`, nav in `components/Layout.tsx`. Use `lib/api.ts` (401 → session expired) and `lib/useApi.ts`. Branding is in `lib/branding.ts`, theme tokens in `index.css` `@theme`, and class strings in `lib/styles.ts`.
- **Contract**: `shared/api.ts` holds the types, pure helpers and exact live-code messages (`liveMessages`).
- **Tests**: migrations are applied via `TEST_MIGRATIONS`; `test/helpers.ts` seeds the fixture (including an Evening offering). Each test file gets its own DB.

## Gotchas
- **Rebuilding an FK-referenced table**: `PRAGMA defer_foreign_keys = true` → copy rows → create new → drop old → rename → re-insert (see 0002/0003). Getting the order wrong gives D1 "internal error". Never edit applied migrations.
- **Global CSS**: keep it in `@layer base`, or it overrides utilities.
- **Worker tsconfig**: uses `bundler` resolution (no `.js` import suffixes).
- **PBKDF2**: capped at 100k iterations on Workers.
- **CSP**: strict (`public/_headers`). No inline scripts, `<style>` tags or external CDNs or fonts.
- **react-refresh lint**: only components may be exported from `.tsx` files (`lib/auth.tsx`'s `useAuth` is the one marked exception).
- **D1 hot spots**: `getOwnedOffering` / faculty offering lists and "recent sessions" compute stats over all history (thousands of rows per call); the live-code poll calls `requireOwnedOffering` every 5 s. Use a lightweight ownership check in new hot paths.
- **Dev-only tooling**: the Agentation toolbar renders only under `import.meta.env.DEV` (`src/main.tsx`). Keep it out of production builds.
- **Source data**: curriculum and faculty JSON stay as published. Note doubts in `sourceIssues`/`notes`.
- **Secrets**: real data and credentials go in gitignored `scripts/data/` (and `logins.txt`). Never commit them or generated SQL.
