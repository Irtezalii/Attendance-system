-- Academic structure for KU/UBIT: programmes, programme curricula, faculty directory
-- profiles separate from login accounts, and enrollment status.
--
-- Non-destructive: existing rows are kept. The faculty table is rebuilt (SQLite cannot
-- drop NOT NULL in place). Foreign-key checks are deferred to the end of the migration
-- so course_offerings.faculty_id keeps pointing at the same ids. Rows are re-inserted
-- *after* the rename: with deferred FKs, dropping the old table counts each referencing
-- course_offerings row as a violation, and only inserts into the table named "faculty"
-- clear those again.
PRAGMA defer_foreign_keys = true;

-- ---- Programmes (BSCS, BSSE, BSAI) ----
ALTER TABLE programs RENAME TO programmes;
ALTER TABLE programmes ADD COLUMN semester_count INTEGER NOT NULL DEFAULT 8 CHECK (semester_count BETWEEN 1 AND 12);
ALTER TABLE programmes ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

ALTER TABLE students RENAME COLUMN program_id TO programme_id;
DROP INDEX idx_students_program;
CREATE INDEX idx_students_programme ON students (programme_id);

-- ---- Courses: credit breakdown as published, e.g. 4 (3+1). Nullable when not given. ----
-- No CHECK that theory + practical = total: some published values do not add up and are
-- preserved as published (see docs/curriculum-validation.md).
ALTER TABLE courses ADD COLUMN theory_credits INTEGER CHECK (theory_credits IS NULL OR theory_credits BETWEEN 0 AND 6);
ALTER TABLE courses ADD COLUMN practical_credits INTEGER CHECK (practical_credits IS NULL OR practical_credits BETWEEN 0 AND 6);

-- ---- Curricula: which courses belong to which programme semester ----
-- A curriculum is a definition. What is actually taught in a term is a course_offering.
CREATE TABLE curricula (
  id                   INTEGER PRIMARY KEY,
  programme_id         INTEGER NOT NULL REFERENCES programmes (id),
  version              TEXT    NOT NULL,
  source_url           TEXT,
  source_retrieved_on  TEXT,
  stated_total_courses INTEGER, -- as printed in the source summary table
  stated_total_credits INTEGER,
  notes                TEXT,
  UNIQUE (programme_id, version)
);

CREATE TABLE curriculum_courses (
  id                     INTEGER PRIMARY KEY,
  curriculum_id          INTEGER NOT NULL REFERENCES curricula (id) ON DELETE CASCADE,
  -- 1..8 for the semester plan; NULL for elective-pool options that are not tied to one semester.
  semester_number        INTEGER CHECK (semester_number IS NULL OR semester_number BETWEEN 1 AND 8),
  position               INTEGER NOT NULL DEFAULT 0, -- order within the semester, as published
  requirement            TEXT    NOT NULL CHECK (requirement IN ('compulsory', 'elective')),
  -- Either a concrete course, or an unfilled slot such as "Domain Elective-1" (code CS-xxx).
  course_id              INTEGER REFERENCES courses (id),
  slot_label             TEXT,
  placeholder_code       TEXT, -- placeholder exactly as published, e.g. 'CS-xxx'
  slot_credit_hours      INTEGER,
  slot_theory_credits    INTEGER,
  slot_practical_credits INTEGER,
  -- Links elective slots to the pool of courses that can fill them, e.g. 'Domain Elective 1, 2'.
  elective_group         TEXT,
  -- Rows sharing an alternative_group are alternatives; a student takes one (e.g. FYP or Thesis).
  alternative_group      TEXT,
  notes                  TEXT,
  CHECK ((course_id IS NULL) <> (slot_label IS NULL)),
  CHECK (semester_number IS NOT NULL OR (requirement = 'elective' AND course_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_curriculum_courses_course ON curriculum_courses (curriculum_id, course_id) WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX uq_curriculum_courses_slot ON curriculum_courses (curriculum_id, semester_number, slot_label) WHERE slot_label IS NOT NULL;
CREATE INDEX idx_curriculum_courses_course ON curriculum_courses (course_id);

-- ---- Faculty: directory profile, optionally linked to a login account ----
CREATE TABLE faculty_copy AS SELECT id, user_id, employee_id, name, designation FROM faculty;
CREATE TABLE faculty_new (
  id                 INTEGER PRIMARY KEY,
  -- NULL = directory entry only; this person cannot sign in.
  user_id            INTEGER UNIQUE REFERENCES users (id),
  -- Stable import key, so re-running the directory import never duplicates people.
  directory_key      TEXT    UNIQUE,
  employee_id        TEXT    UNIQUE,
  name               TEXT    NOT NULL,
  designation        TEXT,
  department         TEXT    NOT NULL DEFAULT 'Department of Computer Science',
  category           TEXT    NOT NULL DEFAULT 'full_time'
                     CHECK (category IN ('full_time', 'teaching_associate', 'visiting', 'inter_departmental', 'compulsory_subjects', 'test_account')),
  email              TEXT    COLLATE NOCASE, -- published contact email; the login email lives in users
  qualifications     TEXT,
  research_interests TEXT,
  directory_notes    TEXT,  -- e.g. "Chairman", "H.E.C. Approved Supervisor"
  profile_url        TEXT,
  image_url          TEXT,
  source_url         TEXT,
  verified_on        TEXT,
  status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);
DROP TABLE faculty;
ALTER TABLE faculty_new RENAME TO faculty;
INSERT INTO faculty (id, user_id, employee_id, name, designation)
  SELECT id, user_id, employee_id, name, designation FROM faculty_copy;
DROP TABLE faculty_copy;
CREATE INDEX idx_faculty_category ON faculty (category);

-- ---- Enrollment status (dropped students keep their history) ----
ALTER TABLE enrollments ADD COLUMN status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'dropped'));
