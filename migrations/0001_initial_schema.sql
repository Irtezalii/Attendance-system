-- Initial schema for the attendance system.
-- D1 enforces foreign keys by default.

-- Login identities. Profile data lives in students / faculty.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('student', 'faculty')),
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Server-side sessions. id is the SHA-256 hex digest of the cookie token,
-- so a leaked database does not leak usable session tokens.
CREATE TABLE sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, -- unix epoch milliseconds
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE programs (
  id   INTEGER PRIMARY KEY,
  code TEXT    NOT NULL UNIQUE,
  name TEXT    NOT NULL
);

CREATE TABLE students (
  id               INTEGER PRIMARY KEY,
  user_id          INTEGER NOT NULL UNIQUE REFERENCES users (id),
  roll_number      TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  current_semester INTEGER NOT NULL CHECK (current_semester BETWEEN 1 AND 8),
  program_id       INTEGER NOT NULL REFERENCES programs (id)
);
CREATE INDEX idx_students_program ON students (program_id);

CREATE TABLE faculty (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users (id),
  employee_id TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  designation TEXT    NOT NULL -- e.g. Professor, Assistant Professor, Lecturer
);

-- One row per (semester number, academic year), e.g. semester 3 of 2026-2027.
CREATE TABLE semesters (
  id            INTEGER PRIMARY KEY,
  number        INTEGER NOT NULL CHECK (number BETWEEN 1 AND 8),
  academic_year TEXT    NOT NULL CHECK (academic_year GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]'),
  status        TEXT    NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  UNIQUE (number, academic_year)
);

CREATE TABLE courses (
  id           INTEGER PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  credit_hours INTEGER NOT NULL CHECK (credit_hours BETWEEN 1 AND 6)
);

-- A course taught in a specific semester by a specific professor.
CREATE TABLE course_offerings (
  id          INTEGER PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses (id),
  semester_id INTEGER NOT NULL REFERENCES semesters (id),
  faculty_id  INTEGER NOT NULL REFERENCES faculty (id),
  section     TEXT    NOT NULL DEFAULT 'A',
  UNIQUE (course_id, semester_id, section)
);
CREATE INDEX idx_offerings_faculty ON course_offerings (faculty_id);
CREATE INDEX idx_offerings_semester ON course_offerings (semester_id);

CREATE TABLE enrollments (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students (id),
  offering_id INTEGER NOT NULL REFERENCES course_offerings (id),
  enrolled_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, offering_id)
);
CREATE INDEX idx_enrollments_offering ON enrollments (offering_id);

CREATE TABLE attendance_sessions (
  id          INTEGER PRIMARY KEY,
  offering_id INTEGER NOT NULL REFERENCES course_offerings (id),
  class_date  TEXT    NOT NULL CHECK (class_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_time  TEXT    NOT NULL CHECK (start_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  topic       TEXT,
  status      TEXT    NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'cancelled')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (offering_id, class_date, start_time)
);

CREATE TABLE attendance_records (
  id            INTEGER PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments (id),
  status        TEXT    NOT NULL CHECK (status IN ('present', 'absent')),
  marked_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, enrollment_id)
);
CREATE INDEX idx_records_enrollment ON attendance_records (enrollment_id);

-- A record's enrollment must belong to the same offering as its session.
CREATE TRIGGER trg_records_offering_match_insert
BEFORE INSERT ON attendance_records
WHEN (SELECT offering_id FROM attendance_sessions WHERE id = NEW.session_id)
  IS NOT (SELECT offering_id FROM enrollments WHERE id = NEW.enrollment_id)
BEGIN
  SELECT RAISE(ABORT, 'enrollment does not belong to the session''s course offering');
END;

CREATE TRIGGER trg_records_offering_match_update
BEFORE UPDATE OF session_id, enrollment_id ON attendance_records
WHEN (SELECT offering_id FROM attendance_sessions WHERE id = NEW.session_id)
  IS NOT (SELECT offering_id FROM enrollments WHERE id = NEW.enrollment_id)
BEGIN
  SELECT RAISE(ABORT, 'enrollment does not belong to the session''s course offering');
END;
