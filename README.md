# College Attendance System

A simple student attendance system for a college. Students see their own courses and per-course attendance; professors see their assigned courses, mark attendance per class, and review summaries.

Runs entirely on Cloudflare: a React SPA served as Workers Static Assets, a Worker API (Hono), and a D1 database.

```
Browser → React (Vite) → Worker /api/* → D1
```

## Requirements

- Node.js 22 or newer (developed on Node 24) and npm
- A Cloudflare account (only for deploying; local development needs nothing)

## Local development

```sh
npm install
npm run db:migrate:local   # create tables in the local D1 database
npm run db:seed:local      # load fictional demo data (scripts/seed-data.example.json)
npm run dev                # http://localhost:5173
```

Demo accounts (password `password123` for all):

| Role    | Email                                    |
| ------- | ---------------------------------------- |
| Faculty | `sara.malik@college.test`                |
| Faculty | `omar.siddiqui@college.test`             |
| Faculty | `hina.raza@college.test`                 |
| Student | `ali.hassan@student.college.test` (and 5 more in the seed file) |

`npm run db:reset:local` wipes the local database and re-runs migrations and the seed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server; the Worker and local D1 run inside it with HMR |
| `npm test` | API tests (Vitest inside the Workers runtime, fresh D1 per run) |
| `npm run lint` | ESLint |
| `npm run build` | Type-check everything, then build client + Worker into `dist/` |
| `npm run preview` | Build and serve the production build locally |
| `npm run deploy` | Build and deploy to Cloudflare |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc` |

## Adding real data (accounts, courses, enrollments)

There is no admin UI. Accounts and course setup are loaded from a JSON file by `scripts/seed.mjs`, which hashes passwords (PBKDF2-SHA256) before writing SQL. Plaintext passwords never reach the database.

1. Copy `scripts/seed-data.example.json` to `scripts/data/college.json` (the `scripts/data/` folder is gitignored, so real student data is never committed).
2. Edit it: programs, semesters, courses, faculty, students, and offerings (course + semester + section + professor + enrolled roll numbers). Remove the `demoAttendance` block; it generates fake attendance history.
3. Generate SQL and apply it:

   ```sh
   node scripts/seed.mjs scripts/data/college.json --out .wrangler/seed/college.sql
   npx wrangler d1 execute attendance-db --remote --file .wrangler/seed/college.sql   # or --local
   ```

The script is safe to re-run: rows are matched by natural keys (email, roll number, course code, …) and existing rows, including passwords, are left unchanged. To add students or enrollments later, add them to the file and run it again.

Give each person a unique initial password (at least 8 characters) and share it privately. Delete generated `.sql` files when done.

## Deploying to Cloudflare

```sh
npx wrangler login
npm run deploy               # first deploy auto-provisions the D1 database "attendance-db"
npm run db:migrate:remote    # create tables in the remote database
# then load your real data as described above, using --remote
```

Run `npm run db:migrate:remote` again whenever a new file is added to `migrations/`.

## How it works

### Data model (`migrations/`)

- `users` – login identity: email, password hash, role (`student` / `faculty`), status.
- `students`, `faculty` – profiles, each linked 1:1 to a user. `programs` holds degree programs.
- `semesters` – one row per semester number (1–8) per academic year, with a status (`upcoming` / `active` / `completed`).
- `courses` – catalogue (code, title, credit hours).
- `course_offerings` – a course taught in a specific semester and section by one professor. The same course in a later year is a new offering, so history is preserved.
- `enrollments` – student × offering (unique).
- `attendance_sessions` – one class of an offering (date, start time, topic, `held` / `cancelled`).
- `attendance_records` – one row per session × enrollment (unique), `present` or `absent`. A trigger rejects records whose enrollment belongs to a different offering than the session.
- `sessions` – login sessions (stores a SHA-256 hash of the cookie token, never the token).

### Attendance calculation

`percentage = attended / held × 100`, rounded to 2 decimals, computed from the records on every request (no stored totals that could drift). `held` counts only non-cancelled classes. With no classes held, the UI shows "No attendance recorded". Completed semesters are read-only.

### Security

- Passwords: PBKDF2-SHA256, 100k iterations, random salt; constant-time comparison; unknown emails take the same time as wrong passwords.
- Sessions: random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` over HTTPS), 7-day expiry, deleted on logout.
- CSRF: state-changing requests must come from the app's own origin and send JSON.
- Login is rate-limited (10 attempts/minute per IP + email) with a Workers Rate Limiting binding.
- Authorization is enforced in the Worker on every query: students only see their own enrollments; professors only see and change offerings assigned to them (others return 404). The frontend route guards are for navigation only.
- All request bodies and IDs are validated with zod on the server.
- Static assets are served with a strict Content-Security-Policy (`public/_headers`).
