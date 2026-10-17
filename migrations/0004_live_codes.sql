-- Live attendance codes. A code session is an ordinary attendance_sessions row (one class)
-- that also carries a 4-digit code students enter to mark themselves present.
-- Validity is enforced from these timestamps on every request (no timers, no cron).

ALTER TABLE attendance_sessions ADD COLUMN code TEXT
  CHECK (code IS NULL OR (length(code) = 4 AND code GLOB '[0-9][0-9][0-9][0-9]'));
-- 'active' rows past code_expires_at are treated as expired immediately and tidied up lazily.
ALTER TABLE attendance_sessions ADD COLUMN code_status TEXT
  CHECK (code_status IS NULL OR code_status IN ('active', 'expired', 'deactivated'));
ALTER TABLE attendance_sessions ADD COLUMN code_started_at INTEGER; -- unix ms, server clock
ALTER TABLE attendance_sessions ADD COLUMN code_expires_at INTEGER; -- unix ms, server clock
ALTER TABLE attendance_sessions ADD COLUMN code_stopped_at INTEGER; -- unix ms, when deactivated
ALTER TABLE attendance_sessions ADD COLUMN started_by_user_id INTEGER REFERENCES users (id);

-- When a student checked in with the code (NULL = marked by the professor).
ALTER TABLE attendance_records ADD COLUMN checked_in_at INTEGER;

-- No two active codes alike, and at most one active code per class (course offering).
CREATE UNIQUE INDEX uq_sessions_active_code ON attendance_sessions (code) WHERE code_status = 'active';
CREATE UNIQUE INDEX uq_sessions_active_offering ON attendance_sessions (offering_id) WHERE code_status = 'active';
CREATE INDEX idx_sessions_code_history ON attendance_sessions (offering_id, code_started_at) WHERE code IS NOT NULL;
