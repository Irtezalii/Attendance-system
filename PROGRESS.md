# Progress

## Completed
- **Phase 1 – Foundation**: React 19 + Vite 8 + Workers scaffold; D1 binding (`attendance-db`, auto-provisioned on deploy); login rate-limit binding; Tailwind v4; react-router v8; Hono + zod in the Worker.
- **Phase 2 – Database**: `migrations/0001_initial_schema.sql`, 11 tables with FKs, unique constraints, CHECKs, indexes, and a trigger that blocks records whose enrollment belongs to a different offering. Supports semesters 1–8 across academic years. `scripts/seed.mjs` produces idempotent seed SQL from JSON. Fictional demo data is in `scripts/seed-data.example.json`.
- **Phase 3 – Auth**: PBKDF2 passwords, hashed server-side session tokens in HttpOnly/SameSite=Lax cookies, logout, CSRF checks, login rate limiting, role and record-level authorization in the Worker.
- **Phase 4 – Student**: dashboard (profile, courses grouped by semester, held/attended/missed/percentage) and per-course history by date.
- **Phase 5 – Faculty**: assigned courses with summaries; per-course students and classes tabs; take attendance (all students must be marked); edit marks, cancel/restore, or delete a class; per-student history within a course.
- **Phase 6 – Partial**: 26 API tests passing (auth, CSRF, student/faculty isolation, calculations, cancelled sessions, constraints). Production build verified with `vite preview` under the CSP. `wrangler deploy --dry-run` passes. All dashboards checked visually in headless Edge.

## Current status
- Feature-complete for the first version. Not yet deployed to Cloudflare (needs `wrangler login` and the account owner's go-ahead).

## Known issues / limitations
- No admin UI. Accounts and courses are managed with the seed script. There is no password change or reset flow yet.
- No "Late" status. Only Present/Absent, as specified for professors.
- The class-date check allows up to one day ahead of UTC, to cover time zones. Dates are not checked against semester start/end, because semesters have no dates in the schema.
- No frontend tests. UI behaviour has been verified manually.
- Existing seed rows are never updated by re-running the seed (by design). Changing a student's semester or a password currently needs manual SQL.

## Next task
- Deploy: `npx wrangler login` → `npm run deploy` → `npm run db:migrate:remote` → load real data with `--remote`. Then smoke-test both roles on the deployed URL.
- After that, consider a CLI script to reset a user's password (generates the hash plus an UPDATE statement).
