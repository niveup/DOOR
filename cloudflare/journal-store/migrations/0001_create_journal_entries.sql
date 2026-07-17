CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL UNIQUE,
  ciphertext TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  edited_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS journal_entries_entry_date_idx ON journal_entries(entry_date DESC);
