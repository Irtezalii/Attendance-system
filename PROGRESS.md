# Progress

## Completed
- **MVP** (commit `901ebd1`): Workers + D1 + React/Tailwind attendance system with session auth, student and faculty dashboards, attendance taking/editing, idempotent seed script, Worker API tests.
- **KU/UBIT enhancement** (branch `ku-ubit-enhancement`):
  - Security fixes:
    - Per-IP login limit added alongside the per-IP+email limit.
    - Signing in again revokes the previous session.
    - Global cleanup of expired sessions.
    - `__Host-` session cookie over HTTPS, and an HSTS header.
    - Inactive faculty profiles can't sign in.
  - Migration `0002_academic_structure.sql`:
    - `programmes` (renamed from `programs`).
    - Theory/practical credits on courses.
    - `curricula` + `curriculum_courses`.
    - Faculty directory profile separated from login.
    - Enrollment status.
    - Applied to a populated database with no data loss and 0 FK violations.
  - Curriculum for BSCS, BSSE and BSAI, Semesters I–VIII plus elective pools, from the official PDFs:
    - 175 courses, 189 curriculum rows.
    - Checked both ways against the extracted PDF text.
    - Import is repeatable and removes stale rows.
    - `docs/curriculum-validation.md` lists the source inconsistencies.
  - Faculty directory: 48 profiles from the official department page (5 categories), with no logins. `scripts/grant-faculty-access.mjs` grants or revokes access per person. See `docs/faculty-directory.md`.
  - Dev seed rebuilt on real course codes:
    - Fictional `DEV-` students in all three programmes and `Test` faculty accounts.
    - Validation of course codes and programmes.
    - Optional `facultyKey` for assigning directory profiles.
  - UI:
    - KU maroon/navy/gold design system with self-hosted Source Serif 4 + Inter.
    - Branded login with a campus background.
    - Role-based navigation with a mobile menu, and a session-expired notice.
    - Student pages: Dashboard, My Courses, Attendance History, Profile.
    - Faculty pages: Dashboard, My Courses, Take Attendance, Attendance Records, Profile.
  - Verified (2026-10-16):
    - 32 API tests pass.
    - 24 end-to-end checks pass against the production build on a fresh database.
    - Data persists across a restart.
    - Every page checked visually at desktop and phone width: no console errors, no horizontal page scroll.
    - `wrangler deploy --dry-run` passes.

## Current status
- Feature-complete on the branch; not merged or deployed.
- The logo and campus photo are labelled placeholders (`public/assets/branding/`). Swap them in `src/lib/branding.ts`.
- Your existing local DB already has migration 0002 plus the curriculum and faculty imports, but still holds the *old* demo accounts. Stop `npm run dev` and run `npm run db:reset:local` to switch to the new dev data.

## Known issues / open questions
- **Curriculum source:** the course tables mentioned in the task were not provided; the official PDFs were used instead. Please confirm, or supply the tables.
- Curriculum issues waiting on the department: see `docs/curriculum-validation.md`. Examples:
  - BSAI totals: 136 credits in the plan vs 141 stated.
  - BSCS course count: 46 vs 47.
  - `CS-354` is printed `4 (2+1)`.
  - `2SE-655` was read as SE-655.
- Faculty discrepancies (Humera / Humera Bashir; Maryam Feroz / Feroze; no detail entry for Mukesh Kumar Rathi Maheshwari): see `docs/faculty-directory.md`.
- No Late status (Present/Absent only; late arrivals are at the professor's discretion).
- No password change/reset in the UI; the department reissues passwords with the scripts.
- Offerings have no status of their own; the semester status (`completed` = read-only) governs editing.
- No frontend unit tests; the UI was verified with end-to-end checks and screenshots.

## Next task
- Provide the official logo and campus photo, confirm the curriculum source, then deploy:
  1. `wrangler login`
  2. `npm run deploy`
  3. `npm run db:migrate:remote`
  4. `npm run db:import:curriculum:remote`
  5. `npm run db:import:faculty:remote`
- After that: a password-change page for users.
