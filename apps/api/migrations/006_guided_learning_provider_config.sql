CREATE TABLE guided_learning_provider_configs (
  session_id TEXT PRIMARY KEY REFERENCES guided_learning_sessions(session_id) ON DELETE CASCADE,
  provider_config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
