export type ReviewStatus = "DRAFT" | "CONFIRMED" | "REJECTED";
export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "INVALID"
  | "INSUFFICIENT_EVIDENCE";

export interface ContextSpan {
  context_span_id: string;
  document_version_id: string;
  page_number: number;
  char_start: number;
  char_end: number;
  text: string;
  page_text_sha256: string;
  extraction_profile_version: string;
}

export interface CanonicalPage {
  document_version_id: string;
  page_number: number;
  canonical_page_text: string;
  page_text_sha256: string;
  extraction_profile_version: string;
}

export interface ProviderConfig {
  provider: "MOCK";
  fixture_id: string;
}

export interface QuestionPlanDraft {
  document_language: string;
  retrieval_queries: string[];
  retrieval_terms: string[];
  questions: Array<{ text: string }>;
}

export interface CandidateClaim {
  text: string;
  claim_type:
    | "PAPER_FACT"
    | "AUTHOR_CLAIM"
    | "AGENT_INFERENCE"
    | "INSUFFICIENT_EVIDENCE";
  candidate_context_span_ids: string[];
}

export type AnswerDraft =
  | { status: "SUCCESS"; claims: CandidateClaim[] }
  | { status: "INSUFFICIENT_EVIDENCE"; claims: CandidateClaim[] };

export interface QuestionPlanJobPayload {
  documentVersionId: string;
  documentLanguage: string;
  pageCount: number;
  contextSpans: ContextSpan[];
  providerConfig: ProviderConfig;
}

export interface AnswerGenerationJobPayload {
  question: { questionId: string; revisionId: string; text: string };
  documentVersionId: string;
  pageCount: number;
  contextSpans: ContextSpan[];
  providerConfig: ProviderConfig;
}
