CREATE TABLE guided_learning_sessions (
  session_id TEXT PRIMARY KEY,
  contract_version TEXT NOT NULL,
  project_id TEXT NOT NULL,
  document_version_id TEXT NOT NULL,
  learning_goal TEXT NOT NULL,
  current_state TEXT NOT NULL,
  current_stage TEXT,
  current_question_id TEXT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  state_version INTEGER NOT NULL CHECK (state_version > 0),
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE guided_learning_directions (
  session_id TEXT NOT NULL REFERENCES guided_learning_sessions(session_id) ON DELETE CASCADE,
  direction_id TEXT NOT NULL,
  direction_json TEXT NOT NULL,
  PRIMARY KEY (session_id, direction_id)
);

CREATE TABLE guided_learning_questions (
  session_id TEXT NOT NULL REFERENCES guided_learning_sessions(session_id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  question_json TEXT NOT NULL,
  PRIMARY KEY (session_id, question_id),
  UNIQUE (session_id, question_order)
);

CREATE TABLE guided_learning_answers (
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  PRIMARY KEY (session_id, question_id),
  FOREIGN KEY (session_id, question_id)
    REFERENCES guided_learning_questions(session_id, question_id) ON DELETE CASCADE
);

CREATE TABLE guided_learning_feedback (
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  feedback_json TEXT NOT NULL,
  PRIMARY KEY (session_id, question_id),
  FOREIGN KEY (session_id, question_id)
    REFERENCES guided_learning_questions(session_id, question_id) ON DELETE CASCADE
);

CREATE TABLE guided_learning_evidence (
  evidence_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES guided_learning_sessions(session_id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  UNIQUE (session_id, question_id, evidence_id),
  FOREIGN KEY (session_id, question_id)
    REFERENCES guided_learning_questions(session_id, question_id) ON DELETE CASCADE
);

CREATE TABLE guided_learning_commands (
  idempotency_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES guided_learning_sessions(session_id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor TEXT NOT NULL,
  result_revision INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE guided_learning_failures (
  failure_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES guided_learning_sessions(session_id) ON DELETE CASCADE,
  failed_operation TEXT NOT NULL,
  resume_state TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
  failed_at TEXT NOT NULL,
  superseded_at TEXT
);

CREATE INDEX guided_learning_sessions_state ON guided_learning_sessions(current_state, updated_at);
CREATE INDEX guided_learning_commands_session ON guided_learning_commands(session_id, created_at);
CREATE INDEX guided_learning_failures_active ON guided_learning_failures(session_id, superseded_at);
