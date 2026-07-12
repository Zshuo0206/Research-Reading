CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE documents (
  document_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE document_versions (
  document_version_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  source_sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL CHECK (page_count > 0),
  extraction_profile_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(document_id, source_sha256)
);

CREATE TABLE question_plans (
  question_plan_id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_versions(document_version_id),
  document_language TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE questions (
  question_id TEXT PRIMARY KEY,
  question_plan_id TEXT NOT NULL REFERENCES question_plans(question_plan_id),
  current_revision_id TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('DRAFT', 'CONFIRMED', 'REJECTED'))
);

CREATE TABLE question_revisions (
  revision_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(question_id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  created_by TEXT NOT NULL CHECK (created_by IN ('MODEL', 'LOCAL_OPERATOR')),
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(question_id, revision_number)
);

CREATE TABLE answers (
  answer_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(question_id),
  current_revision_id TEXT,
  review_status TEXT NOT NULL CHECK (review_status IN ('DRAFT', 'CONFIRMED', 'REJECTED')),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('PENDING', 'VERIFIED', 'INVALID', 'INSUFFICIENT_EVIDENCE'))
);

CREATE TABLE answer_revisions (
  revision_id TEXT PRIMARY KEY,
  answer_id TEXT NOT NULL REFERENCES answers(answer_id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  created_by TEXT NOT NULL CHECK (created_by IN ('MODEL', 'LOCAL_OPERATOR')),
  content_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(answer_id, revision_number)
);

CREATE TABLE evidence_spans (
  evidence_span_id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_versions(document_version_id),
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  char_start INTEGER NOT NULL CHECK (char_start >= 0),
  char_end INTEGER NOT NULL CHECK (char_end > char_start),
  quote TEXT NOT NULL,
  page_text_sha256 TEXT NOT NULL,
  extraction_profile_version TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('PENDING', 'VERIFIED', 'INVALID', 'INSUFFICIENT_EVIDENCE'))
);

CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('DOCUMENT_IMPORT', 'QUESTION_PLAN', 'ANSWER_GENERATION')),
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

CREATE INDEX jobs_claimable ON jobs(state, created_at);
