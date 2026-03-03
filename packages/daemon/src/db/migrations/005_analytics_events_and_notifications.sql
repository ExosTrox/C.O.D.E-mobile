-- Analytics events table for detailed event tracking
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  event_type TEXT NOT NULL,
  provider_id TEXT,
  data TEXT, -- JSON blob for event-specific data
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Budget settings
CREATE TABLE IF NOT EXISTS budget_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  daily_limit REAL,
  weekly_limit REAL,
  monthly_limit REAL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
