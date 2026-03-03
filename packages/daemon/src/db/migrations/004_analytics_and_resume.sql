-- 004_analytics_and_resume.sql: Token analytics + session resume support

-- Token analytics snapshots per session
CREATE TABLE IF NOT EXISTS session_analytics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER,
  estimated_cost REAL,
  recorded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_analytics_session ON session_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_time ON session_analytics(recorded_at);

-- Session resume: add conversation_id column for Claude Code --resume
ALTER TABLE sessions ADD COLUMN conversation_id TEXT;
