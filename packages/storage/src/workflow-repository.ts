import type { DatabaseSync } from "node:sqlite";
import type {
  AnswerClaimRecord,
  AnswerRecord,
  CreatedBy,
  QuestionRecord,
  ReviewStatus,
  StoredContextSpan,
  StoredEvidenceSpan,
  VerificationStatus,
} from "./types.js";

type SqlRow = Record<string, unknown>;

export class WorkflowStorageError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "WorkflowStorageError";
  }
}

export interface NewQuestion {
  questionId: string;
  revisionId: string;
  text: string;
  contentHash: string;
}

export interface NewEvidence extends StoredEvidenceSpan {}

export class WorkflowRepository {
  constructor(private readonly database: DatabaseSync) {}

  createQuestionPlan(input: {
    questionPlanId: string;
    documentVersionId: string;
    documentLanguage: string;
    retrievalQueries: readonly string[];
    retrievalTerms: readonly string[];
    questions: readonly NewQuestion[];
    createdAt: string;
  }): void {
    this.transaction(() => {
      this.database
        .prepare(
          "INSERT INTO question_plans(question_plan_id, document_version_id, document_language, retrieval_queries_json, retrieval_terms_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          input.questionPlanId,
          input.documentVersionId,
          input.documentLanguage,
          JSON.stringify(input.retrievalQueries),
          JSON.stringify(input.retrievalTerms),
          input.createdAt,
        );
      const insertQuestion = this.database.prepare(
        "INSERT INTO questions(question_id, question_plan_id, current_revision_id, review_status) VALUES (?, ?, ?, 'DRAFT')",
      );
      const insertRevision = this.database.prepare(
        "INSERT INTO question_revisions(revision_id, question_id, revision_number, created_by, text, content_hash, created_at) VALUES (?, ?, 1, 'MODEL', ?, ?, ?)",
      );
      for (const question of input.questions) {
        insertQuestion.run(
          question.questionId,
          input.questionPlanId,
          question.revisionId,
        );
        insertRevision.run(
          question.revisionId,
          question.questionId,
          question.text,
          question.contentHash,
          input.createdAt,
        );
      }
    });
  }

  getQuestion(questionId: string): QuestionRecord | undefined {
    const row = this.database
      .prepare(
        `SELECT q.question_id, q.question_plan_id, q.current_revision_id, q.review_status,
                p.document_version_id, r.revision_id, r.revision_number, r.created_by,
                r.created_at, r.content_hash, r.supersedes_revision_id, r.text
           FROM questions q
           JOIN question_plans p ON p.question_plan_id = q.question_plan_id
           JOIN question_revisions r ON r.revision_id = q.current_revision_id
          WHERE q.question_id = ?`,
      )
      .get(questionId) as SqlRow | undefined;
    return row ? mapQuestion(row) : undefined;
  }

  editQuestion(input: {
    questionId: string;
    expectedRevisionId: string;
    revisionId: string;
    text: string;
    contentHash: string;
    createdAt: string;
  }): QuestionRecord {
    this.transaction(() => {
      const current = this.requireQuestion(input.questionId);
      if (current.currentRevisionId !== input.expectedRevisionId)
        throw new WorkflowStorageError(
          "CONFLICT",
          `Question ${input.questionId} revision changed`,
        );
      this.database
        .prepare(
          "INSERT INTO question_revisions(revision_id, question_id, revision_number, created_by, text, content_hash, created_at, supersedes_revision_id) VALUES (?, ?, ?, 'LOCAL_OPERATOR', ?, ?, ?, ?)",
        )
        .run(
          input.revisionId,
          input.questionId,
          current.revision.revisionNumber + 1,
          input.text,
          input.contentHash,
          input.createdAt,
          current.currentRevisionId,
        );
      const updated = this.database
        .prepare(
          "UPDATE questions SET current_revision_id = ?, review_status = 'DRAFT' WHERE question_id = ? AND current_revision_id = ?",
        )
        .run(input.revisionId, input.questionId, input.expectedRevisionId);
      if (updated.changes !== 1)
        throw new WorkflowStorageError(
          "CONFLICT",
          `Question ${input.questionId} revision changed`,
        );
    });
    return this.requireQuestion(input.questionId);
  }

  setQuestionReviewStatus(
    questionId: string,
    expectedRevisionId: string,
    status: Extract<ReviewStatus, "CONFIRMED" | "REJECTED">,
  ): QuestionRecord {
    const current = this.requireQuestion(questionId);
    if (current.currentRevisionId !== expectedRevisionId)
      throw new WorkflowStorageError(
        "CONFLICT",
        `Question ${questionId} revision changed`,
      );
    if (current.reviewStatus !== "DRAFT")
      throw new WorkflowStorageError(
        "INVALID_TRANSITION",
        `Question ${questionId} must be DRAFT before ${status}`,
      );
    const updated = this.database
      .prepare(
        "UPDATE questions SET review_status = ? WHERE question_id = ? AND current_revision_id = ? AND review_status = 'DRAFT'",
      )
      .run(status, questionId, expectedRevisionId);
    if (updated.changes !== 1)
      throw new WorkflowStorageError(
        "CONFLICT",
        `Question ${questionId} changed`,
      );
    return this.requireQuestion(questionId);
  }

  saveContextSpans(spans: readonly StoredContextSpan[]): void {
    this.transaction(() => {
      const statement = this.database.prepare(
        "INSERT OR IGNORE INTO context_spans(context_span_id, document_version_id, page_number, char_start, char_end, text, page_text_sha256, extraction_profile_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      );
      for (const span of spans) {
        statement.run(
          span.contextSpanId,
          span.documentVersionId,
          span.pageNumber,
          span.charStart,
          span.charEnd,
          span.text,
          span.pageTextSha256,
          span.extractionProfileVersion,
        );
        const persisted = this.database
          .prepare("SELECT * FROM context_spans WHERE context_span_id = ?")
          .get(span.contextSpanId) as SqlRow;
        if (
          String(persisted.document_version_id) !== span.documentVersionId ||
          Number(persisted.page_number) !== span.pageNumber ||
          Number(persisted.char_start) !== span.charStart ||
          Number(persisted.char_end) !== span.charEnd ||
          String(persisted.text) !== span.text ||
          String(persisted.page_text_sha256) !== span.pageTextSha256 ||
          String(persisted.extraction_profile_version) !==
            span.extractionProfileVersion
        )
          throw new WorkflowStorageError(
            "CONFLICT",
            `ContextSpan ${span.contextSpanId} is immutable`,
          );
      }
    });
  }

  createAnswer(input: {
    answerId: string;
    questionId: string;
    expectedQuestionRevisionId: string;
    revisionId: string;
    claims: readonly AnswerClaimRecord[];
    contentHash: string;
    verificationStatus: VerificationStatus;
    evidence: readonly NewEvidence[];
    createdAt: string;
  }): AnswerRecord {
    this.transaction(() => {
      const question = this.requireQuestion(input.questionId);
      if (question.reviewStatus !== "CONFIRMED")
        throw new WorkflowStorageError(
          "INVALID_TRANSITION",
          `Question ${input.questionId} is not confirmed`,
        );
      if (question.currentRevisionId !== input.expectedQuestionRevisionId)
        throw new WorkflowStorageError(
          "CONFLICT",
          `Question ${input.questionId} revision changed after answer generation was requested`,
        );
      this.database
        .prepare(
          "INSERT INTO answers(answer_id, question_id, current_revision_id, review_status, verification_status) VALUES (?, ?, ?, 'DRAFT', ?)",
        )
        .run(
          input.answerId,
          input.questionId,
          input.revisionId,
          input.verificationStatus,
        );
      this.insertAnswerRevision({
        answerId: input.answerId,
        revisionId: input.revisionId,
        revisionNumber: 1,
        createdBy: "MODEL",
        claims: input.claims,
        contentHash: input.contentHash,
        supersedesRevisionId: null,
        createdAt: input.createdAt,
        evidence: input.evidence,
      });
    });
    return this.requireAnswer(input.answerId);
  }

  editAnswer(input: {
    answerId: string;
    expectedRevisionId: string;
    revisionId: string;
    claims: readonly AnswerClaimRecord[];
    contentHash: string;
    verificationStatus: VerificationStatus;
    evidence: readonly NewEvidence[];
    createdAt: string;
  }): AnswerRecord {
    this.transaction(() => {
      const current = this.requireAnswer(input.answerId);
      if (current.currentRevisionId !== input.expectedRevisionId)
        throw new WorkflowStorageError(
          "CONFLICT",
          `Answer ${input.answerId} revision changed`,
        );
      this.insertAnswerRevision({
        answerId: input.answerId,
        revisionId: input.revisionId,
        revisionNumber: current.revision.revisionNumber + 1,
        createdBy: "LOCAL_OPERATOR",
        claims: input.claims,
        contentHash: input.contentHash,
        supersedesRevisionId: current.currentRevisionId,
        createdAt: input.createdAt,
        evidence: input.evidence,
      });
      const updated = this.database
        .prepare(
          "UPDATE answers SET current_revision_id = ?, review_status = 'DRAFT', verification_status = ? WHERE answer_id = ? AND current_revision_id = ?",
        )
        .run(
          input.revisionId,
          input.verificationStatus,
          input.answerId,
          input.expectedRevisionId,
        );
      if (updated.changes !== 1)
        throw new WorkflowStorageError(
          "CONFLICT",
          `Answer ${input.answerId} revision changed`,
        );
    });
    return this.requireAnswer(input.answerId);
  }

  setAnswerReviewStatus(
    answerId: string,
    expectedRevisionId: string,
    status: Extract<ReviewStatus, "CONFIRMED" | "REJECTED">,
  ): AnswerRecord {
    const current = this.requireAnswer(answerId);
    if (current.currentRevisionId !== expectedRevisionId)
      throw new WorkflowStorageError(
        "CONFLICT",
        `Answer ${answerId} revision changed`,
      );
    if (current.reviewStatus !== "DRAFT")
      throw new WorkflowStorageError(
        "INVALID_TRANSITION",
        `Answer ${answerId} must be DRAFT before ${status}`,
      );
    if (status === "CONFIRMED" && current.verificationStatus !== "VERIFIED")
      throw new WorkflowStorageError(
        "INVALID_TRANSITION",
        `Answer ${answerId} must be VERIFIED before confirmation`,
      );
    const updated = this.database
      .prepare(
        "UPDATE answers SET review_status = ? WHERE answer_id = ? AND current_revision_id = ? AND review_status = 'DRAFT'",
      )
      .run(status, answerId, expectedRevisionId);
    if (updated.changes !== 1)
      throw new WorkflowStorageError("CONFLICT", `Answer ${answerId} changed`);
    return this.requireAnswer(answerId);
  }

  getAnswer(answerId: string): AnswerRecord | undefined {
    const row = this.database
      .prepare(
        `SELECT a.answer_id, a.question_id, a.current_revision_id, a.review_status,
                a.verification_status, r.revision_id, r.revision_number,
                r.created_by, r.created_at, r.content_hash, r.supersedes_revision_id,
                r.content_json
           FROM answers a
           JOIN answer_revisions r ON r.revision_id = a.current_revision_id
          WHERE a.answer_id = ?`,
      )
      .get(answerId) as SqlRow | undefined;
    return row ? mapAnswer(row) : undefined;
  }

  getEvidenceForRevision(revisionId: string): StoredEvidenceSpan[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM answer_evidence_spans WHERE answer_revision_id = ? ORDER BY claim_id, evidence_span_id",
        )
        .all(revisionId) as SqlRow[]
    ).map(mapEvidence);
  }

  private requireQuestion(questionId: string): QuestionRecord {
    const question = this.getQuestion(questionId);
    if (!question)
      throw new WorkflowStorageError(
        "NOT_FOUND",
        `Question ${questionId} not found`,
      );
    return question;
  }

  private requireAnswer(answerId: string): AnswerRecord {
    const answer = this.getAnswer(answerId);
    if (!answer)
      throw new WorkflowStorageError(
        "NOT_FOUND",
        `Answer ${answerId} not found`,
      );
    return answer;
  }

  private insertAnswerRevision(input: {
    answerId: string;
    revisionId: string;
    revisionNumber: number;
    createdBy: CreatedBy;
    claims: readonly AnswerClaimRecord[];
    contentHash: string;
    supersedesRevisionId: string | null;
    createdAt: string;
    evidence: readonly NewEvidence[];
  }): void {
    this.database
      .prepare(
        "INSERT INTO answer_revisions(revision_id, answer_id, revision_number, created_by, content_json, content_hash, created_at, supersedes_revision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        input.revisionId,
        input.answerId,
        input.revisionNumber,
        input.createdBy,
        JSON.stringify({ claims: input.claims }),
        input.contentHash,
        input.createdAt,
        input.supersedesRevisionId,
      );
    const insertEvidence = this.database.prepare(
      "INSERT INTO answer_evidence_spans(evidence_span_id, answer_revision_id, claim_id, context_span_id, document_version_id, page_number, char_start, char_end, quote, page_text_sha256, extraction_profile_version, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const evidence of input.evidence)
      insertEvidence.run(
        evidence.evidenceSpanId,
        input.revisionId,
        evidence.claimId,
        evidence.contextSpanId,
        evidence.documentVersionId,
        evidence.pageNumber,
        evidence.charStart,
        evidence.charEnd,
        evidence.quote,
        evidence.pageTextSha256,
        evidence.extractionProfileVersion,
        evidence.verificationStatus,
      );
  }

  private transaction(operation: () => void): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      operation();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function mapQuestion(row: SqlRow): QuestionRecord {
  return {
    questionId: String(row.question_id),
    questionPlanId: String(row.question_plan_id),
    documentVersionId: String(row.document_version_id),
    currentRevisionId: String(row.current_revision_id),
    reviewStatus: row.review_status as ReviewStatus,
    revision: {
      revisionId: String(row.revision_id),
      revisionNumber: Number(row.revision_number),
      createdBy: row.created_by as CreatedBy,
      createdAt: String(row.created_at),
      contentHash: String(row.content_hash),
      supersedesRevisionId:
        row.supersedes_revision_id === null
          ? null
          : String(row.supersedes_revision_id),
      text: String(row.text),
    },
  };
}

function mapAnswer(row: SqlRow): AnswerRecord {
  const content = JSON.parse(String(row.content_json)) as {
    claims: AnswerClaimRecord[];
  };
  return {
    answerId: String(row.answer_id),
    questionId: String(row.question_id),
    currentRevisionId: String(row.current_revision_id),
    reviewStatus: row.review_status as ReviewStatus,
    verificationStatus: row.verification_status as VerificationStatus,
    revision: {
      revisionId: String(row.revision_id),
      revisionNumber: Number(row.revision_number),
      createdBy: row.created_by as CreatedBy,
      createdAt: String(row.created_at),
      contentHash: String(row.content_hash),
      supersedesRevisionId:
        row.supersedes_revision_id === null
          ? null
          : String(row.supersedes_revision_id),
      claims: content.claims,
    },
  };
}

function mapEvidence(row: SqlRow): StoredEvidenceSpan {
  return {
    evidenceSpanId: String(row.evidence_span_id),
    answerRevisionId: String(row.answer_revision_id),
    claimId: String(row.claim_id),
    contextSpanId: String(row.context_span_id),
    documentVersionId: String(row.document_version_id),
    pageNumber: Number(row.page_number),
    charStart: Number(row.char_start),
    charEnd: Number(row.char_end),
    quote: String(row.quote),
    pageTextSha256: String(row.page_text_sha256),
    extractionProfileVersion: String(row.extraction_profile_version),
    verificationStatus: row.verification_status as "VERIFIED" | "INVALID",
  };
}
