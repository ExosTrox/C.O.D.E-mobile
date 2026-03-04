-- API key encrypted storage
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(provider_id)
);
