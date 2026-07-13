import { createHash, randomUUID } from "node:crypto";
import type {
  AnswerDraft,
  AnswerGenerationJobPayload,
  CanonicalPage,
  ContextSpan,
  ProviderConfig,
  QuestionPlanDraft,
  QuestionPlanJobPayload,
} from "./types.js";

type JobKind = "QUESTION_PLAN" | "ANSWER_GENERATION";
type ReviewStatus = "DRAFT" | "CONFIRMED" | "REJECTED";
type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "INVALID"
  | "INSUFFICIENT_EVIDENCE";

export interface JobRecord<TPayload = unknown> {
  jobId: string;
  kind: "DOCUMENT_IMPORT" | JobKind;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  payload: TPayload;
  result: unknown;
  errorMessage: string | null;
  idempotencyKey: string;
  workerId: string | null;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface QuestionRecord {
  questionId: string;
  questionPlanId: string;
  documentVersionId: string;
  currentRevisionId: string;
  reviewStatus: ReviewStatus;
  revision: {
    revisionId: string;
    revisionNumber: number;
    createdBy: "MODEL" | "LOCAL_OPERATOR";
    createdAt: string;
    contentHash: string;
    supersedesRevisionId: string | null;
    text: string;
  };
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

export interface AnswerRecord {
  answerId: string;
  questionId: string;
  currentRevisionId: string;
  reviewStatus: ReviewStatus;
  verificationStatus: VerificationStatus;
  revision: {
    revisionId: string;
    revisionNumber: number;
    createdBy: "MODEL" | "LOCAL_OPERATOR";
    createdAt: string;
    contentHash: string;
    supersedesRevisionId: string | null;
    claims: AnswerClaimRecord[];
  };
}

interface StoredContextSpan {
  contextSpanId: string;
  documentVersionId: string;
  pageNumber: number;
  charStart: number;
  charEnd: number;
  text: string;
  pageTextSha256: string;
  extractionProfileVersion: string;
}

interface StoredEvidenceSpan {
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

export interface JobStorage {
  createOrGetJob<T>(input: {
    jobId: string;
    kind: "DOCUMENT_IMPORT" | JobKind;
    payload: T;
    idempotencyKey: string;
    maxAttempts?: number;
    createdAt?: string;
  }): JobRecord<T>;
}

export interface WorkflowStorage {
  createQuestionPlan(input: {
    questionPlanId: string;
    documentVersionId: string;
    documentLanguage: string;
    retrievalQueries: readonly string[];
    retrievalTerms: readonly string[];
    questions: ReadonlyArray<{
      questionId: string;
      revisionId: string;
      text: string;
      contentHash: string;
    }>;
    createdAt: string;
  }): void;
  getQuestion(questionId: string): QuestionRecord | undefined;
  editQuestion(input: {
    questionId: string;
    expectedRevisionId: string;
    revisionId: string;
    text: string;
    contentHash: string;
    createdAt: string;
  }): QuestionRecord;
  setQuestionReviewStatus(
    questionId: string,
    expectedRevisionId: string,
    status: "CONFIRMED" | "REJECTED",
  ): QuestionRecord;
  saveContextSpans(spans: readonly StoredContextSpan[]): void;
  createAnswer(input: {
    answerId: string;
    questionId: string;
    expectedQuestionRevisionId: string;
    revisionId: string;
    claims: readonly AnswerClaimRecord[];
    contentHash: string;
    verificationStatus: VerificationStatus;
    evidence: readonly StoredEvidenceSpan[];
    createdAt: string;
  }): AnswerRecord;
  editAnswer(input: {
    answerId: string;
    expectedRevisionId: string;
    revisionId: string;
    claims: readonly AnswerClaimRecord[];
    contentHash: string;
    verificationStatus: VerificationStatus;
    evidence: readonly StoredEvidenceSpan[];
    createdAt: string;
  }): AnswerRecord;
  setAnswerReviewStatus(
    answerId: string,
    expectedRevisionId: string,
    status: "CONFIRMED" | "REJECTED",
  ): AnswerRecord;
}

export class WorkflowError extends Error {
  constructor(
    readonly code: "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export interface WorkflowIds {
  job(): string;
  questionPlan(): string;
  question(): string;
  questionRevision(): string;
  answer(): string;
  answerRevision(): string;
  claim(): string;
  evidence(): string;
}

const defaultIds: WorkflowIds = {
  job: () => `job_${randomUUID()}`,
  questionPlan: () => `qplan_${randomUUID()}`,
  question: () => `question_${randomUUID()}`,
  questionRevision: () => `qrev_${randomUUID()}`,
  answer: () => `answer_${randomUUID()}`,
  answerRevision: () => `arev_${randomUUID()}`,
  claim: () => `claim_${randomUUID()}`,
  evidence: () => `evidence_${randomUUID()}`,
};

export class WorkflowService {
  constructor(
    private readonly storage: JobStorage,
    private readonly workflow: WorkflowStorage,
    private readonly ids: WorkflowIds = defaultIds,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  enqueueQuestionPlan(input: {
    documentVersionId: string;
    documentLanguage: string;
    pageCount: number;
    contextSpans: ContextSpan[];
    canonicalPages: CanonicalPage[];
    providerConfig: ProviderConfig;
    idempotencyKey: string;
  }): JobRecord<QuestionPlanJobPayload> {
    validateContextSpans(input.contextSpans, input.canonicalPages);
    requireDocumentVersion(input.contextSpans, input.documentVersionId);
    const payload: QuestionPlanJobPayload = {
      documentVersionId: input.documentVersionId,
      documentLanguage: input.documentLanguage,
      pageCount: input.pageCount,
      contextSpans: input.contextSpans,
      providerConfig: input.providerConfig,
    };
    return this.storage.createOrGetJob({
      jobId: this.ids.job(),
      kind: "QUESTION_PLAN",
      payload,
      idempotencyKey: input.idempotencyKey,
      createdAt: this.now(),
    });
  }

  materializeQuestionPlan(
    payload: QuestionPlanJobPayload,
    draft: QuestionPlanDraft,
  ): QuestionRecord[] {
    if (draft.questions.length === 0)
      throw new WorkflowError(
        "VALIDATION_ERROR",
        "Question plan must contain at least one question",
      );
    if (draft.document_language !== payload.documentLanguage)
      throw new WorkflowError(
        "VALIDATION_ERROR",
        "Question plan language does not match the requested document language",
      );
    const questionPlanId = this.ids.questionPlan();
    const createdAt = this.now();
    const questions = draft.questions.map((question) => {
      if (question.text.trim().length === 0)
        throw new WorkflowError(
          "VALIDATION_ERROR",
          "Question text must not be empty",
        );
      return {
        questionId: this.ids.question(),
        revisionId: this.ids.questionRevision(),
        text: question.text,
        contentHash: hashJson({ text: question.text }),
      };
    });
    this.workflow.createQuestionPlan({
      questionPlanId,
      documentVersionId: payload.documentVersionId,
      documentLanguage: draft.document_language,
      retrievalQueries: draft.retrieval_queries,
      retrievalTerms: draft.retrieval_terms,
      questions,
      createdAt,
    });
    return questions.map((question) =>
      requireValue(this.workflow.getQuestion(question.questionId)),
    );
  }

  editQuestion(
    questionId: string,
    expectedRevisionId: string,
    text: string,
  ): QuestionRecord {
    if (text.trim().length === 0)
      throw new WorkflowError(
        "VALIDATION_ERROR",
        "Question text must not be empty",
      );
    return this.workflow.editQuestion({
      questionId,
      expectedRevisionId,
      revisionId: this.ids.questionRevision(),
      text,
      contentHash: hashJson({ text }),
      createdAt: this.now(),
    });
  }

  confirmQuestion(questionId: string, revisionId: string): QuestionRecord {
    return this.workflow.setQuestionReviewStatus(
      questionId,
      revisionId,
      "CONFIRMED",
    );
  }

  rejectQuestion(questionId: string, revisionId: string): QuestionRecord {
    return this.workflow.setQuestionReviewStatus(
      questionId,
      revisionId,
      "REJECTED",
    );
  }

  enqueueAnswer(input: {
    questionId: string;
    contextSpans: ContextSpan[];
    canonicalPages: CanonicalPage[];
    pageCount: number;
    providerConfig: ProviderConfig;
    idempotencyKey: string;
  }): JobRecord<AnswerGenerationJobPayload> {
    const question = this.workflow.getQuestion(input.questionId);
    if (!question)
      throw new WorkflowError(
        "NOT_FOUND",
        `Question ${input.questionId} not found`,
      );
    if (question.reviewStatus !== "CONFIRMED")
      throw new WorkflowError(
        "CONFLICT",
        `Question ${input.questionId} must be confirmed before answer generation`,
      );
    validateContextSpans(input.contextSpans, input.canonicalPages);
    requireDocumentVersion(input.contextSpans, question.documentVersionId);
    this.workflow.saveContextSpans(input.contextSpans.map(toStoredContextSpan));
    const payload: AnswerGenerationJobPayload = {
      question: {
        questionId: question.questionId,
        revisionId: question.currentRevisionId,
        text: question.revision.text,
      },
      documentVersionId: question.documentVersionId,
      pageCount: input.pageCount,
      contextSpans: input.contextSpans,
      providerConfig: input.providerConfig,
    };
    return this.storage.createOrGetJob({
      jobId: this.ids.job(),
      kind: "ANSWER_GENERATION",
      payload,
      idempotencyKey: input.idempotencyKey,
      createdAt: this.now(),
    });
  }

  materializeAnswer(
    payload: AnswerGenerationJobPayload,
    draft: AnswerDraft,
    canonicalPages: CanonicalPage[],
  ): AnswerRecord {
    validateContextSpans(payload.contextSpans, canonicalPages);
    const answerId = this.ids.answer();
    const revisionId = this.ids.answerRevision();
    const materialized = this.materializeClaims(
      revisionId,
      draft,
      payload.contextSpans,
      canonicalPages,
    );
    return this.workflow.createAnswer({
      answerId,
      questionId: payload.question.questionId,
      expectedQuestionRevisionId: payload.question.revisionId,
      revisionId,
      claims: materialized.claims,
      contentHash: hashJson({ claims: materialized.claims }),
      verificationStatus: materialized.verificationStatus,
      evidence: materialized.evidence,
      createdAt: this.now(),
    });
  }

  editAnswer(input: {
    answerId: string;
    expectedRevisionId: string;
    draft: AnswerDraft;
    contextSpans: ContextSpan[];
    canonicalPages: CanonicalPage[];
  }): AnswerRecord {
    validateContextSpans(input.contextSpans, input.canonicalPages);
    this.workflow.saveContextSpans(input.contextSpans.map(toStoredContextSpan));
    const revisionId = this.ids.answerRevision();
    const materialized = this.materializeClaims(
      revisionId,
      input.draft,
      input.contextSpans,
      input.canonicalPages,
    );
    return this.workflow.editAnswer({
      answerId: input.answerId,
      expectedRevisionId: input.expectedRevisionId,
      revisionId,
      claims: materialized.claims,
      contentHash: hashJson({ claims: materialized.claims }),
      verificationStatus: materialized.verificationStatus,
      evidence: materialized.evidence,
      createdAt: this.now(),
    });
  }

  confirmAnswer(answerId: string, revisionId: string): AnswerRecord {
    return this.workflow.setAnswerReviewStatus(
      answerId,
      revisionId,
      "CONFIRMED",
    );
  }

  rejectAnswer(answerId: string, revisionId: string): AnswerRecord {
    return this.workflow.setAnswerReviewStatus(
      answerId,
      revisionId,
      "REJECTED",
    );
  }

  private materializeClaims(
    revisionId: string,
    draft: AnswerDraft,
    contextSpans: ContextSpan[],
    canonicalPages: CanonicalPage[],
  ): {
    claims: AnswerClaimRecord[];
    evidence: StoredEvidenceSpan[];
    verificationStatus: "VERIFIED" | "INSUFFICIENT_EVIDENCE";
  } {
    if (draft.claims.length === 0)
      throw new WorkflowError(
        "VALIDATION_ERROR",
        "Answer must contain a claim",
      );
    const insufficient = draft.status === "INSUFFICIENT_EVIDENCE";
    if (
      insufficient !==
      (draft.claims.length === 1 &&
        draft.claims[0]?.claim_type === "INSUFFICIENT_EVIDENCE" &&
        draft.claims[0].candidate_context_span_ids.length === 0)
    )
      throw new WorkflowError(
        "VALIDATION_ERROR",
        "Insufficient-evidence output must contain exactly one refusal claim without evidence",
      );
    const byId = new Map(
      contextSpans.map((span) => [span.context_span_id, span]),
    );
    const evidence: StoredEvidenceSpan[] = [];
    const claims = draft.claims.map((candidate) => {
      if (!insufficient && candidate.claim_type === "INSUFFICIENT_EVIDENCE")
        throw new WorkflowError(
          "VALIDATION_ERROR",
          "Successful answers cannot contain an insufficient-evidence claim",
        );
      if (!insufficient && candidate.candidate_context_span_ids.length === 0)
        throw new WorkflowError(
          "VALIDATION_ERROR",
          "Supported claims require candidate ContextSpan references",
        );
      const claimId = this.ids.claim();
      const evidenceRefs = candidate.candidate_context_span_ids.map(
        (contextId) => {
          const span = byId.get(contextId);
          if (!span)
            throw new WorkflowError(
              "VALIDATION_ERROR",
              `Unknown candidate ContextSpan ${contextId}`,
            );
          const page = findPage(span, canonicalPages);
          validateContextSpan(span, page);
          const evidenceSpanId = this.ids.evidence();
          evidence.push({
            evidenceSpanId,
            answerRevisionId: revisionId,
            claimId,
            contextSpanId: span.context_span_id,
            documentVersionId: span.document_version_id,
            pageNumber: span.page_number,
            charStart: span.char_start,
            charEnd: span.char_end,
            quote: span.text,
            pageTextSha256: span.page_text_sha256,
            extractionProfileVersion: span.extraction_profile_version,
            verificationStatus: "VERIFIED",
          });
          return evidenceSpanId;
        },
      );
      return {
        claimId,
        text: candidate.text,
        claimType: candidate.claim_type,
        evidenceRefs,
      } satisfies AnswerClaimRecord;
    });
    return {
      claims,
      evidence,
      verificationStatus: insufficient ? "INSUFFICIENT_EVIDENCE" : "VERIFIED",
    };
  }
}

export function validateContextSpans(
  spans: readonly ContextSpan[],
  pages: readonly CanonicalPage[],
): void {
  if (spans.length === 0)
    throw new WorkflowError(
      "VALIDATION_ERROR",
      "At least one ContextSpan is required",
    );
  if (new Set(spans.map((span) => span.context_span_id)).size !== spans.length)
    throw new WorkflowError(
      "VALIDATION_ERROR",
      "ContextSpan identifiers must be unique",
    );
  for (const span of spans) validateContextSpan(span, findPage(span, pages));
}

function requireDocumentVersion(
  spans: readonly ContextSpan[],
  documentVersionId: string,
): void {
  if (spans.some((span) => span.document_version_id !== documentVersionId))
    throw new WorkflowError(
      "VALIDATION_ERROR",
      "ContextSpans must belong to the workflow document version",
    );
}

function validateContextSpan(span: ContextSpan, page: CanonicalPage): void {
  const codePoints = Array.from(page.canonical_page_text);
  const valid =
    span.document_version_id === page.document_version_id &&
    span.page_number === page.page_number &&
    span.page_text_sha256 === page.page_text_sha256 &&
    span.extraction_profile_version === page.extraction_profile_version &&
    Number.isInteger(span.char_start) &&
    Number.isInteger(span.char_end) &&
    span.char_start >= 0 &&
    span.char_start < span.char_end &&
    span.char_end <= codePoints.length &&
    codePoints.slice(span.char_start, span.char_end).join("") === span.text;
  if (!valid)
    throw new WorkflowError(
      "VALIDATION_ERROR",
      `ContextSpan ${span.context_span_id} does not match canonical page text and coordinates`,
    );
}

function findPage(
  span: ContextSpan,
  pages: readonly CanonicalPage[],
): CanonicalPage {
  const page = pages.find(
    (candidate) =>
      candidate.document_version_id === span.document_version_id &&
      candidate.page_number === span.page_number,
  );
  if (!page)
    throw new WorkflowError(
      "VALIDATION_ERROR",
      `Canonical page for ${span.context_span_id} is unavailable`,
    );
  return page;
}

function toStoredContextSpan(span: ContextSpan): StoredContextSpan {
  return {
    contextSpanId: span.context_span_id,
    documentVersionId: span.document_version_id,
    pageNumber: span.page_number,
    charStart: span.char_start,
    charEnd: span.char_end,
    text: span.text,
    pageTextSha256: span.page_text_sha256,
    extractionProfileVersion: span.extraction_profile_version,
  };
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireValue<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Persisted workflow record missing");
  return value;
}
