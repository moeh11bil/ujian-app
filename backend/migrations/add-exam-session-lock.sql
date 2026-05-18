ALTER TABLE exam_sessions
  ADD COLUMN is_locked TINYINT(1) DEFAULT 0 AFTER is_active;
