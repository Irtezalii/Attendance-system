# Progress

## Done
- **MVP** (`901ebd1`): Workers + D1 + React; session auth; student/faculty dashboards; manual attendance; Worker API tests.
- **KU/UBIT** (`4ccdd5b`, `b288c75`): security hardening; curriculum for BSCS/BSSE/BSAI (official PDFs, `docs/curriculum-validation.md`); 48 faculty directory profiles (`docs/faculty-directory.md`); KU branding and role-based pages.
- **Uncommitted** (branch `ku-ubit-enhancement`):
  - Branding: official logo (header, login, favicon) and UBIT campus photo; sliding compact header; centred nav; My Profile in the header (sign out moved to the profile page).
  - Morning/Evening (migration 0003): separate offerings per schedule; triggers block cross-schedule and cross-programme enrollment; programme/schedule badges and filters on Take Attendance and My Courses.
  - Live attendance codes (migration 0004): professor chat window with START, EXTEND +5 and STOP; 10-minute 4-digit codes enforced by the server; student check-in on the dashboard; rate-limited.
  - Location check (migration 0005): a "Require location" toggle (off by default). Students must check in from inside a 400 × 400 m box centred on UBIT (`CAMPUS_*` vars; the point comes from OpenStreetMap and should be verified on a map). The professor's device location isn't needed, because laptops are too imprecise. Students are told how far outside they are or what to fix, and refusals are shown to the professor. A deterrent, not proof: GPS can be spoofed.
  - Agentation installed but switched off.
- **Verified**: 49 API tests pass; type-check, lint and build are clean; live flow checked in the browser on the production build.

## Status
- Not committed, merged or deployed. Restart `npm run dev` after `wrangler.jsonc` changes.
- Local DB is migrated to 0004 with dev data, including Evening students. Backups are in the scratchpad.

## Open issues
- Curriculum taken from the official PDFs (the user's tables were never provided). Source inconsistencies are listed in `docs/curriculum-validation.md`.
- Campus photo is 960×305 and looks soft on large screens.
- No Late status; no password change in the UI; no frontend unit tests.
- A student enrolled after a code was started has no record for that class (mark them manually).

## Next
1. Commit the uncommitted work.
2. Deploy: `wrangler login` → `npm run deploy` → `npm run db:migrate:remote` → `db:import:curriculum:remote` → `db:import:faculty:remote`.
3. Password-change page.
