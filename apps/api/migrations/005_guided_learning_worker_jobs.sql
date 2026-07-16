CREATE TABLE jobs_new (
  job_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN (
    'DOCUMENT_IMPORT',
    'QUESTION_PLAN',
    'ANSWER_GENERATION',
    'GUIDED_LEARNING_DIRECTION_GENERATION',
    'GUIDED_LEARNING_QUESTION_GENERATION',
    'GUIDED_LEARNING_FEEDBACK_GENERATION',
    'GUIDED_LEARNING_STAGE_SUMMARY_GENERATION'
  )),
  state TEXT NOT NULL CHECK (state IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  payload_json TEXT NOT NULL,
  result_json TEXT,
  error_message TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  worker_id TEXT,
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 10),
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

INSERT INTO jobs_new (
  job_id, kind, state, payload_json, result_json, error_message,
  idempotency_key, worker_id, attempt, max_attempts, created_at,
  started_at, finished_at
)
SELECT
  job_id, kind, state, payload_json, result_json, error_message,
  idempotency_key, worker_id, attempt, max_attempts, created_at,
  started_at, finished_at
FROM jobs;

DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;
CREATE INDEX jobs_claimable ON jobs(state, created_at);
