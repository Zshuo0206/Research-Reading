ALTER TABLE question_plans ADD COLUMN retrieval_queries_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE question_plans ADD COLUMN retrieval_terms_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE question_revisions ADD COLUMN supersedes_revision_id TEXT REFERENCES question_revisions(revision_id);
ALTER TABLE answer_revisions ADD COLUMN supersedes_revision_id TEXT REFERENCES answer_revisions(revision_id);

CREATE TABLE context_spans (
  context_span_id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_versions(document_version_id),
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  char_start INTEGER NOT NULL CHECK (char_start >= 0),
  char_end INTEGER NOT NULL CHECK (char_end > char_start),
  text TEXT NOT NULL,
  page_text_sha256 TEXT NOT NULL,
  extraction_profile_version TEXT NOT NULL
);

CREATE TABLE answer_evidence_spans (
  evidence_span_id TEXT PRIMARY KEY,
  answer_revision_id TEXT NOT NULL REFERENCES answer_revisions(revision_id),
  claim_id TEXT NOT NULL,
  context_span_id TEXT NOT NULL REFERENCES context_spans(context_span_id),
  document_version_id TEXT NOT NULL REFERENCES document_versions(document_version_id),
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  char_start INTEGER NOT NULL CHECK (char_start >= 0),
  char_end INTEGER NOT NULL CHECK (char_end > char_start),
  quote TEXT NOT NULL,
  page_text_sha256 TEXT NOT NULL,
  extraction_profile_version TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'INVALID')),
  UNIQUE(answer_revision_id, claim_id, context_span_id)
);

CREATE INDEX answer_evidence_by_revision ON answer_evidence_spans(answer_revision_id, claim_id);

