-- 003_permissions.sql: Permission policies and pending requests

CREATE TABLE IF NOT EXISTS permission_policies (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  tool TEXT NOT NULL,
  path_pattern TEXT,
  action TEXT NOT NULL DEFAULT 'ask' CHECK (action IN ('allow', 'deny', 'ask')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permission_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  input TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'allowed', 'denied', 'expired')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_permission_policies_session ON permission_policies(session_id);
CREATE INDEX IF NOT EXISTS idx_permission_policies_tool ON permission_policies(tool);
CREATE INDEX IF NOT EXISTS idx_permission_requests_session ON permission_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status ON permission_requests(status);
