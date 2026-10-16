# Faculty directory import

- **Source:** <https://www.uok.edu.pk/department-computerscience>, "Faculty" tab
- **Retrieved and verified:** 2026-10-16
- **Data file:** `data/faculty/ubit-cs-directory.json` (48 entries)
- **Import:** `npm run db:import:faculty:local` (or `:remote`)

## What was imported

| Category (as on the page) | `category` value | Entries |
| --- | --- | ---: |
| Full-Time Faculty Members (Associate Professors, Assistant Professors, Lecturers) | `full_time` | 16 |
| Teaching Associate / Teaching Assistant | `teaching_associate` | 3 |
| Inter-Departmental Faculty Members | `inter_departmental` | 12 |
| Visiting Faculty Members | `visiting` | 9 |
| Compulsory Subjects | `compulsory_subjects` | 8 |

Only what the page shows was recorded: name and title as written, designation (from the section heading), department, qualifications, research areas, published `@uok.edu.pk` email and the one linked profile page. Everything else is `null`. All 48 names and all 15 published emails were checked mechanically against the page HTML.

**No entry gets a login.** Directory profiles are information only. Access is granted per person with `scripts/grant-faculty-access.mjs` (see README).

## Discrepancies on the source page

- "Dr. Humera" (Assistant Professors list) is matched to the detailed entry "Dr. Humera Bashir" (email `humera.azam@uok.edu.pk`). Please confirm.
- "Dr. Humera Tariq (S.L)": the meaning of "(S.L)" is not stated; kept in notes.
- "Ms. Maryam Feroz" (list) vs "Ms. Maryam Feroze" (detailed entry); the detailed spelling is used.
- "Mr. Mukesh Kumar Rathi Maheshwari" is listed as an Assistant Professor but has no detailed entry.
- "Dr. M. Sadiq Ali Khan" is marked Chairman and H.E.C. Approved Supervisor; "Dr. Muhammad Saeed" H.E.C. Approved Supervisor (kept in notes).
- "Prof. Dr. Mudassir Uddin" is marked "(Rtd.)"; "Professor Dr. S. M. Aqil Burney" is shown with affiliation "(IOBM)".
- Many entries have no published email, qualifications or research areas; these are `null`, not guessed.
- The page is not guaranteed to be complete or current. Re-check it before granting access, and update the JSON file (then re-run the import) when it changes.

## Updating

Edit `data/faculty/ubit-cs-directory.json` and re-run the import. Entries are matched by their `key`, so directory fields are refreshed without creating duplicates. Access-related fields (`user_id`, `employee_id`, `status`) are never changed by the import.
