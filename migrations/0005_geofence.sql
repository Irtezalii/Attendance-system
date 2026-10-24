-- Optional location check for live attendance codes, anchored to the professor's position
-- when the code was started. Students' coordinates are never stored, only distance/accuracy.

ALTER TABLE attendance_sessions ADD COLUMN geo_required INTEGER NOT NULL DEFAULT 0 CHECK (geo_required IN (0, 1));
ALTER TABLE attendance_sessions ADD COLUMN geo_lat REAL CHECK (geo_lat IS NULL OR geo_lat BETWEEN -90 AND 90);
ALTER TABLE attendance_sessions ADD COLUMN geo_lng REAL CHECK (geo_lng IS NULL OR geo_lng BETWEEN -180 AND 180);
ALTER TABLE attendance_sessions ADD COLUMN geo_accuracy_m REAL; -- professor's GPS accuracy at start
ALTER TABLE attendance_sessions ADD COLUMN geo_radius_m INTEGER CHECK (geo_radius_m IS NULL OR geo_radius_m BETWEEN 10 AND 1000);

ALTER TABLE attendance_records ADD COLUMN checkin_distance_m REAL;
ALTER TABLE attendance_records ADD COLUMN checkin_accuracy_m REAL;

-- Check-ins refused by the location check, so the professor can review genuine cases.
-- Only recorded for students enrolled in the class who entered its valid, active code.
CREATE TABLE checkin_rejections (
  id            INTEGER PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments (id),
  reason        TEXT    NOT NULL CHECK (reason IN ('out_of_range', 'imprecise', 'no_location')),
  distance_m    REAL,
  accuracy_m    REAL,
  at            INTEGER NOT NULL -- unix ms
);
CREATE INDEX idx_checkin_rejections_session ON checkin_rejections (session_id, enrollment_id);
