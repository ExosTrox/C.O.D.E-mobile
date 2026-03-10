-- 007_multi_user.sql: Multi-user support with machine pairing

-- Add role to users (admin = first user, user = everyone else)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Add user_id to sessions for ownership
ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id);

-- Index for user session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Machine pairing table: one machine per user
CREATE TABLE IF NOT EXISTS user_machines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  ssh_port INTEGER NOT NULL UNIQUE,
  ssh_user TEXT NOT NULL DEFAULT 'go',
  ssh_host TEXT NOT NULL DEFAULT 'localhost',
  status TEXT NOT NULL DEFAULT 'pending',
  label TEXT,
  paired_at INTEGER,
  last_seen INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_machines_status ON user_machines(status);

-- Port allocation tracking
CREATE TABLE IF NOT EXISTS port_allocations (
  port INTEGER PRIMARY KEY,
  user_id TEXT UNIQUE,
  allocated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Pairing tokens (short-lived, single-use)
CREATE TABLE IF NOT EXISTS pairing_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ssh_port INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mark existing user as admin
UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);

-- Assign existing sessions to the first user
UPDATE sessions SET user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1) WHERE user_id IS NULL;
