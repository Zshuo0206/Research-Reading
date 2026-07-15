CREATE TABLE document_pages (
  document_version_id TEXT NOT NULL REFERENCES document_versions(document_version_id),
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  canonical_page_text TEXT NOT NULL,
  page_text_sha256 TEXT NOT NULL,
  extraction_profile_version TEXT NOT NULL,
  code_point_length INTEGER NOT NULL CHECK (code_point_length >= 0),
  PRIMARY KEY (document_version_id, page_number)
);
