-- Morning / Evening schedules. A course taught in both schedules has one offering per
-- schedule, each with its own enrollments and attendance.
PRAGMA defer_foreign_keys = true;

ALTER TABLE students ADD COLUMN shift TEXT NOT NULL DEFAULT 'morning' CHECK (shift IN ('morning', 'evening'));

-- Rebuild course_offerings so the uniqueness rule can include the shift. Rows are
-- re-inserted after the rename (see CLAUDE.md: deferred FK counters).
CREATE TABLE course_offerings_copy AS SELECT id, course_id, semester_id, faculty_id, section FROM course_offerings;
CREATE TABLE course_offerings_new (
  id          INTEGER PRIMARY KEY,
  course_id   INTEGER NOT NULL REFERENCES courses (id),
  semester_id INTEGER NOT NULL REFERENCES semesters (id),
  faculty_id  INTEGER NOT NULL REFERENCES faculty (id),
  section     TEXT    NOT NULL DEFAULT 'A',
  shift       TEXT    NOT NULL DEFAULT 'morning' CHECK (shift IN ('morning', 'evening')),
  UNIQUE (course_id, semester_id, shift, section)
);
DROP TABLE course_offerings;
ALTER TABLE course_offerings_new RENAME TO course_offerings;
INSERT INTO course_offerings (id, course_id, semester_id, faculty_id, section)
  SELECT id, course_id, semester_id, faculty_id, section FROM course_offerings_copy;
DROP TABLE course_offerings_copy;
CREATE INDEX idx_offerings_faculty ON course_offerings (faculty_id);
CREATE INDEX idx_offerings_semester ON course_offerings (semester_id);

-- A student may only be enrolled in offerings of their own schedule...
CREATE TRIGGER trg_enrollments_shift_insert
BEFORE INSERT ON enrollments
WHEN (SELECT shift FROM students WHERE id = NEW.student_id)
  IS NOT (SELECT shift FROM course_offerings WHERE id = NEW.offering_id)
BEGIN
  SELECT RAISE(ABORT, 'student schedule (morning/evening) does not match the course offering');
END;

CREATE TRIGGER trg_enrollments_shift_update
BEFORE UPDATE OF student_id, offering_id ON enrollments
WHEN (SELECT shift FROM students WHERE id = NEW.student_id)
  IS NOT (SELECT shift FROM course_offerings WHERE id = NEW.offering_id)
BEGIN
  SELECT RAISE(ABORT, 'student schedule (morning/evening) does not match the course offering');
END;

-- ...and of their own programme, when the course belongs to a curriculum.
CREATE TRIGGER trg_enrollments_programme_insert
BEFORE INSERT ON enrollments
WHEN EXISTS (
    SELECT 1 FROM curriculum_courses
     WHERE course_id = (SELECT course_id FROM course_offerings WHERE id = NEW.offering_id))
  AND NOT EXISTS (
    SELECT 1 FROM curriculum_courses cc JOIN curricula cu ON cu.id = cc.curriculum_id
     WHERE cc.course_id = (SELECT course_id FROM course_offerings WHERE id = NEW.offering_id)
       AND cu.programme_id = (SELECT programme_id FROM students WHERE id = NEW.student_id))
BEGIN
  SELECT RAISE(ABORT, 'student programme does not include this course');
END;
