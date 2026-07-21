CREATE TABLE IF NOT EXISTS tracker_study_logs (
  id TEXT PRIMARY KEY,
  log_date TEXT NOT NULL,
  time_block TEXT NOT NULL DEFAULT 'Evening',
  subject_id INTEGER NOT NULL,
  subject_name TEXT NOT NULL,
  hours_studied REAL NOT NULL DEFAULT 0.0,
  questions_solved INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tracker_study_logs_date_idx ON tracker_study_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS tracker_study_logs_subject_idx ON tracker_study_logs(subject_id);
