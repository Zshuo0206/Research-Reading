export type GuidedLearningJobKind =
  | "GUIDED_LEARNING_DIRECTION_GENERATION"
  | "GUIDED_LEARNING_QUESTION_GENERATION"
  | "GUIDED_LEARNING_FEEDBACK_GENERATION"
  | "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION";
export type JobKind =
  | "DOCUMENT_IMPORT"
  | "QUESTION_PLAN"
  | "ANSWER_GENERATION"
  | GuidedLearningJobKind;
export type GuidedLearningByokProvider =
  | "OPENAI"
  | "GEMINI"
  | "GROQ"
  | "OPENROUTER"
  | "CUSTOM_OPENAI_COMPATIBLE";
export type GuidedLearningProviderConfig =
  | { provider: "MOCK"; fixture_id: string }
  | {
      provider: GuidedLearningByokProvider;
      base_url: string;
      model: string;
      request_timeout_ms: number;
      max_input_characters: number;
      max_output_tokens: number;
    };
export type JobState = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
export type ReviewStatus = "DRAFT" | "CONFIRMED" | "REJECTED";
export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "INVALID"
  | "INSUFFICIENT_EVIDENCE";

export interface JobRecord<TPayload = unknown, TResult = unknown> {
  jobId: string;
  kind: JobKind;
  state: JobState;
  payload: TPayload;
  result: TResult | null;
  errorMessage: string | null;
  idempotencyKey: string;
  workerId: string | null;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CreateJobInput<TPayload = unknown> {
  jobId: string;
  kind: JobKind;
  payload: TPayload;
  idempotencyKey: string;
  maxAttempts?: number;
  createdAt?: string;
}

export interface GuidedLearningGenerationJobPayload {
  schema_version: "guided-learning.v1";
  operation: GuidedLearningJobKind;
  session_id: string;
  project_id: string;
  document_version_id: string;
  learning_goal: string;
  expected_revision: number;
  expected_state:
    | "CREATED"
    | "ROUTE_LOCKED"
    | "QUESTIONS_GENERATING"
    | "ANSWER_SUBMITTED"
    | "QUESTION_COMPLETED"
    | "SUMMARY_GENERATING";
  provider_config: GuidedLearningProviderConfig;
  selected_direction_id?: string;
  question_id?: string;
  question_order?: number;
}

export interface DocumentPageRecord {
  documentVersionId: string;
  pageNumber: number;
  canonicalPageText: string;
  pageTextSha256: string;
  extractionProfileVersion: string;
  codePointLength: number;
}

export type CreatedBy = "MODEL" | "LOCAL_OPERATOR";

export interface QuestionRevisionRecord {
  revisionId: string;
  revisionNumber: number;
  createdBy: CreatedBy;
  createdAt: string;
  contentHash: string;
  supersedesRevisionId: string | null;
  text: string;
}

export interface QuestionRecord {
  questionId: string;
  questionPlanId: string;
  documentVersionId: string;
  currentRevisionId: string;
  reviewStatus: ReviewStatus;
  revision: QuestionRevisionRecord;
}

export interface AnswerClaimRecord {
  claimId: string;
  text: string;
  claimType:
    | "PAPER_FACT"
    | "AUTHOR_CLAIM"
    | "AGENT_INFERENCE"
    | "INSUFFICIENT_EVIDENCE";
  evidenceRefs: string[];
}

export interface AnswerRevisionRecord {
  revisionId: string;
  revisionNumber: number;
  createdBy: CreatedBy;
  createdAt: string;
  contentHash: string;
  supersedesRevisionId: string | null;
  claims: AnswerClaimRecord[];
}

export interface AnswerRecord {
  answerId: string;
  questionId: string;
  currentRevisionId: string;
  reviewStatus: ReviewStatus;
  verificationStatus: VerificationStatus;
  revision: AnswerRevisionRecord;
}

export interface StoredContextSpan {
  contextSpanId: string;
  documentVersionId: string;
  pageNumber: number;
  charStart: number;
  charEnd: number;
  text: string;
  pageTextSha256: string;
  extractionProfileVersion: string;
}

export interface StoredEvidenceSpan {
  evidenceSpanId: string;
  answerRevisionId: string;
  claimId: string;
  contextSpanId: string;
  documentVersionId: string;
  pageNumber: number;
  charStart: number;
  charEnd: number;
  quote: string;
  pageTextSha256: string;
  extractionProfileVersion: string;
  verificationStatus: "VERIFIED" | "INVALID";
}
