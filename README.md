# UBIT Student Attendance System

Attendance system for the Department of Computer Science, Umair Basha Institute of Information Technology (UBIT), University of Karachi. Students follow their attendance per course; faculty record attendance for the course offerings assigned to them.

Runs entirely on Cloudflare: a React SPA served as Workers Static Assets, a Worker API (Hono), and a D1 database.

```
Browser → React (Vite, Tailwind) → Worker /api/* → D1
```

## Requirements

- Node.js 22 or newer (developed on Node 24) and npm
- A Cloudflare account, only for deploying. Local development needs nothing else.

No environment variables or secrets are needed. Configuration lives in `wrangler.jsonc` (D1 database `attendance-db`, two login rate limiters).

## Local development

```sh
npm install
npm run db:setup:local   # migrations + curriculum + faculty directory + fictional dev accounts
npm run dev              # http://localhost:5173
```

`npm run db:reset:local` wipes the local database and runs the setup again. Stop `npm run dev` first; the database files are locked while it runs.

### Development accounts

All fictional (`DEV-` roll numbers, `.test` email domains, "Test" faculty). Password `password123` for every account.

| Role | Email | Notes |
| --- | --- | --- |
| Student (BSCS, sem 3) | `ali.hassan@student.ubit.test` | plus 3 more BSCS students |
| Student (BSSE, sem 3) | `bilal.ahmed@student.ubit.test` | plus 2 more |
| Student (BSAI, sem 1) | `sana.kareem@student.ubit.test` | plus 2 more |
| Faculty | `test.alpha@faculty.ubit.test` | also `test.beta@…`, `test.gamma@…` |

The dev seed (`scripts/seed-data.example.json`) creates semesters 1–8 for 2026-2027, a completed 2025-2026 semester 2, course offerings using real curriculum codes, enrollments, and synthetic attendance. Imported directory faculty have **no** logins.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server; the Worker and local D1 run inside it with HMR |
| `npm test` | API tests (Vitest inside the Workers runtime, fresh D1) |
| `npm run lint` | ESLint |
| `npm run build` | Type-check everything, then build client + Worker into `dist/` |
| `npm run preview` | Build and serve the production build locally |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run db:migrate:local` / `:remote` | Apply D1 migrations (`migrations/`) |
| `npm run db:import:curriculum:local` / `:remote` | Import BSCS/BSSE/BSAI curricula; refreshes `docs/curriculum-validation.md` |
| `npm run db:import:faculty:local` / `:remote` | Import faculty directory profiles |
| `npm run db:seed:local` | Load fictional development accounts and data (local only) |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` |

## Academic data

### Curriculum

`data/curriculum/{bscs,bsse,bsai}.json` hold the semester-wise course plans (Semesters I–VIII) and elective pools, transcribed from the department's official curriculum PDFs (linked from <https://www.uok.edu.pk/department-computerscience#bs>, retrieved 2026-10-16). Each course keeps its programme-specific code, title, credit hours and theory/practical breakdown as published. Elective slots with placeholder codes (`CS-xxx`, …) are stored as slots linked to their elective pool, and the BSAI Project/Thesis options as alternatives.

`scripts/import-curriculum.mjs` is safe to re-run: it upserts on natural keys and removes curriculum rows that were deleted from a file. It also writes **`docs/curriculum-validation.md`**, which lists every inconsistency found in the sources (for example totals that do not add up). Values are never corrected silently; fix the JSON only once the department confirms a change.

A curriculum is a definition. A **course offering** is a course actually taught in a semester by an assigned professor; enrollments and attendance belong to offerings.

### Faculty directory and access

`data/faculty/ubit-cs-directory.json` holds the profiles published on the department page (see **`docs/faculty-directory.md`** for the source, date and discrepancies). Importing a profile does not grant access. To let one authorised person sign in:

```sh
node scripts/grant-faculty-access.mjs --key sadiq-ali-khan --email <their login email> --out .wrangler/seed/access.sql
npx wrangler d1 execute attendance-db --remote --file .wrangler/seed/access.sql
```

This prints a one-time password once. Share it privately and delete the `.sql` file. `--revoke` instead of `--email` disables the account and ends its sessions; the profile and teaching history are kept.

### Students, semesters, offerings and enrollments (real data)

Real records go through `scripts/seed.mjs` with a data file kept in the gitignored `scripts/data/` folder:

1. Copy `scripts/seed-data.example.json` to `scripts/data/college.json`. Replace the fictional people, give each person a unique initial password (8+ characters), and remove `demoAttendance` (it generates fake attendance).
2. Generate the SQL and apply it:

   ```sh
   node scripts/seed.mjs scripts/data/college.json --out .wrangler/seed/college.sql
   npx wrangler d1 execute attendance-db --remote --file .wrangler/seed/college.sql
   ```

The script refuses offerings whose course code is not in the curriculum, or whose students belong to another programme. Re-running never overwrites existing rows or passwords. Students are only enrolled in the offerings listed, never automatically in every curriculum course. To assign a real professor, use `"facultyKey": "<directory key>"` in the offering (instead of `"faculty"`, which refers to an `employeeId` of an account in the same file), and grant them access with `grant-faculty-access.mjs`.

Never commit real student data, passwords or generated `.sql` files.

## Deploying to Cloudflare

```sh
npx wrangler login
npm run deploy                       # first deploy auto-provisions the D1 database "attendance-db"
npm run db:migrate:remote
npm run db:import:curriculum:remote
npm run db:import:faculty:remote
# then grant faculty access and load students/offerings as described above (--remote)
```

Run `npm run db:migrate:remote` whenever a new file is added to `migrations/`.

## Replacing the logo and campus photo

The logo (`Logo.png`) and the login background photo (`ubit-campus.png`) are in `public/assets/branding/`. To replace either:

1. Copy the new file into `public/assets/branding/`. Give it a proper extension (`.png`, `.jpg`, `.webp`): the server picks the content type from it, and browsers refuse images served without one.
2. Update `logo.src` or `loginBackground.src` in `src/lib/branding.ts`.

The login photo is shown full-height behind a maroon overlay, so a landscape image of at least ~1600 px wide looks sharpest.

Institution names shown in the UI are in the same file. Colours (KU maroon `#7c0405`, navy `#081933`, gold `#d4af37`) and fonts (Source Serif 4, Inter; self-hosted) are defined in `src/index.css`.

## How it works

### Data model (`migrations/`)

- `users`: login identity (email, PBKDF2 hash, role, status). `sessions`: hashed session tokens.
- `programmes`: BSCS, BSSE, BSAI (8 semesters each). `students` belong to a programme and have a current semester.
- `faculty`: directory profile (category, designation, department, published details, source and verification date), optionally linked to a `users` row.
- `courses`: programme-specific course codes with credit hours and theory/practical breakdown.
- `curricula` + `curriculum_courses`: which courses (or elective slots) belong to which programme semester.
- `semesters`: one row per semester number (1–8) per academic year, `upcoming` / `active` / `completed`.
- `course_offerings`: course × semester × section → professor. `enrollments`: student × offering, `enrolled` / `dropped`.
- `attendance_sessions` (held / cancelled) and `attendance_records` (present / absent, one per session × enrollment; a trigger rejects enrollments from another offering).

### Live attendance codes

**Take Attendance → Take attendance** opens the attendance window for that exact course offering (programme, schedule, semester, section).

- **Take New Attendance** creates today's class with a 4-digit code valid for 10 minutes. Every enrolled student starts as Absent.
- Students enter the code under **Mark attendance** on their dashboard, which marks them Present.
- **Extend +5 min** and **Stop attendance** control the code. The same can be typed as `Start`, `Extend-1234` or `Deactivate-1234`.
- The server enforces all of this. A code only works for students enrolled in that offering: same programme, semester, section and Morning/Evening. It stops working the moment it expires or is stopped.
- Students get 6 attempts per minute.
- Class dates and times use `APP_TIMEZONE` in `wrangler.jsonc` (`Asia/Karachi`).
- Marks can still be corrected afterwards from the class page.

### Attendance rules

`percentage = attended / held × 100`, rounded to 2 decimals and always computed from the records. Present counts as attended, absent does not. Cancelled classes do not count. With no classes held the UI shows "No attendance recorded". There is no Late status: a late arrival is marked Present or Absent by the professor. Completed semesters are read-only. Dropped students leave the roster but keep their history.

### Security

- Passwords: PBKDF2-SHA256 (100k iterations, random salt), constant-time comparison, equal timing for unknown emails.
- Sessions: random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (`__Host-` prefixed and `Secure` over HTTPS), 7-day expiry, stored only as a SHA-256 hash, revoked on logout and on re-login.
- CSRF: state-changing requests must come from the app's own origin and send JSON.
- Login rate limits: 10/min per IP + email and 30/min per IP.
- Authorization in the Worker on every query: students only see their own enrollments; professors only see and change their own offerings (others get 404). Inactive faculty profiles and disabled accounts cannot sign in. Roles come from the account, never from the client.
- All request bodies and IDs are validated with zod. There are no seed or admin HTTP endpoints; data is managed with the local scripts above.
- Static assets are served with a strict CSP and HSTS (`public/_headers`).
