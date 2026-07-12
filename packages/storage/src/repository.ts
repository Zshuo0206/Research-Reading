import type { DatabaseSync } from "node:sqlite";
import type {
  CreateJobInput,
  JobRecord,
  JobState,
  ReviewStatus,
  VerificationStatus,
} from "./types.js";

type SqlRow = Record<string, unknown>;

export class StorageRepository {
  constructor(private readonly database: DatabaseSync) {}

  createProject(
    projectId: string,
    name: string,
    createdAt = new Date().toISOString(),
  ): void {
    this.database
      .prepare(
        "INSERT INTO projects(project_id, name, created_at) VALUES (?, ?, ?)",
      )
      .run(projectId, name, createdAt);
  }

  getProject(projectId: string): SqlRow | undefined {
    return this.database
      .prepare("SELECT * FROM projects WHERE project_id = ?")
      .get(projectId) as SqlRow | undefined;
  }

  createDocument(
    documentId: string,
    projectId: string,
    title: string,
    createdAt = new Date().toISOString(),
  ): void {
    this.database
      .prepare(
        "INSERT INTO documents(document_id, project_id, title, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(documentId, projectId, title, createdAt);
  }

  createDocumentVersion(input: {
    documentVersionId: string;
    documentId: string;
    sourceSha256: string;
    pageCount: number;
    extractionProfileVersion: string;
    createdAt?: string;
  }): void {
    this.database
      .prepare(
        "INSERT INTO document_versions(document_version_id, document_id, source_sha256, page_count, extraction_profile_version, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        input.documentVersionId,
        input.documentId,
        input.sourceSha256,
        input.pageCount,
        input.extractionProfileVersion,
        input.createdAt ?? new Date().toISOString(),
      );
  }

  getDocumentVersion(documentVersionId: string): SqlRow | undefined {
    return this.database
      .prepare("SELECT * FROM document_versions WHERE document_version_id = ?")
      .get(documentVersionId) as SqlRow | undefined;
  }

  createQuestion(input: {
    questionPlanId: string;
    documentVersionId: string;
    documentLanguage: string;
    questionId: string;
    revisionId: string;
    text: string;
    contentHash: string;
    createdBy: "MODEL" | "LOCAL_OPERATOR";
    reviewStatus?: ReviewStatus;
    createdAt?: string;
  }): void {
    const at = input.createdAt ?? new Date().toISOString();
    this.transaction(() => {
      this.database
        .prepare(
          "INSERT OR IGNORE INTO question_plans(question_plan_id, document_version_id, document_language, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(
          input.questionPlanId,
          input.documentVersionId,
          input.documentLanguage,
          at,
        );
      this.database
        .prepare(
          "INSERT INTO questions(question_id, question_plan_id, review_status) VALUES (?, ?, ?)",
        )
        .run(
          input.questionId,
          input.questionPlanId,
          input.reviewStatus ?? "DRAFT",
        );
      this.database
        .prepare(
          "INSERT INTO question_revisions(revision_id, question_id, revision_number, created_by, text, content_hash, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)",
        )
        .run(
          input.revisionId,
          input.questionId,
          input.createdBy,
          input.text,
          input.contentHash,
          at,
        );
      this.database
        .prepare(
          "UPDATE questions SET current_revision_id = ? WHERE question_id = ?",
        )
        .run(input.revisionId, input.questionId);
    });
  }

  getQuestion(questionId: string): SqlRow | undefined {
    return this.database
      .prepare(
        "SELECT q.*, r.text, r.revision_number FROM questions q JOIN question_revisions r ON r.revision_id = q.current_revision_id WHERE q.question_id = ?",
      )
      .get(questionId) as SqlRow | undefined;
  }

  createAnswer(input: {
    answerId: string;
    questionId: string;
    revisionId: string;
    content: unknown;
    contentHash: string;
    createdBy: "MODEL" | "LOCAL_OPERATOR";
    reviewStatus?: ReviewStatus;
    verificationStatus?: VerificationStatus;
    createdAt?: string;
  }): void {
    const at = input.createdAt ?? new Date().toISOString();
    this.transaction(() => {
      this.database
        .prepare(
          "INSERT INTO answers(answer_id, question_id, review_status, verification_status) VALUES (?, ?, ?, ?)",
        )
        .run(
          input.answerId,
          input.questionId,
          input.reviewStatus ?? "DRAFT",
          input.verificationStatus ?? "PENDING",
        );
      this.database
        .prepare(
          "INSERT INTO answer_revisions(revision_id, answer_id, revision_number, created_by, content_json, content_hash, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)",
        )
        .run(
          input.revisionId,
          input.answerId,
          input.createdBy,
          JSON.stringify(input.content),
          input.contentHash,
          at,
        );
      this.database
        .prepare(
          "UPDATE answers SET current_revision_id = ? WHERE answer_id = ?",
        )
        .run(input.revisionId, input.answerId);
    });
  }

  createEvidenceSpan(input: {
    evidenceSpanId: string;
    documentVersionId: string;
    pageNumber: number;
    charStart: number;
    charEnd: number;
    quote: string;
    pageTextSha256: string;
    extractionProfileVersion: string;
    verificationStatus?: VerificationStatus;
  }): void {
    this.database
      .prepare(
        "INSERT INTO evidence_spans(evidence_span_id, document_version_id, page_number, char_start, char_end, quote, page_text_sha256, extraction_profile_version, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        input.evidenceSpanId,
        input.documentVersionId,
        input.pageNumber,
        input.charStart,
        input.charEnd,
        input.quote,
        input.pageTextSha256,
        input.extractionProfileVersion,
        input.verificationStatus ?? "PENDING",
      );
  }

  createJob<T>(input: CreateJobInput<T>): JobRecord<T> {
    this.database
      .prepare(
        "INSERT INTO jobs(job_id, kind, state, payload_json, idempotency_key, attempt, max_attempts, created_at) VALUES (?, ?, 'QUEUED', ?, ?, 0, ?, ?)",
      )
      .run(
        input.jobId,
        input.kind,
        JSON.stringify(input.payload),
        input.idempotencyKey,
        input.maxAttempts ?? 1,
        input.createdAt ?? new Date().toISOString(),
      );
    const created = this.getJob<T>(input.jobId);
    if (!created) throw new Error(`Job ${input.jobId} was not persisted`);
    return created;
  }

  getJob<TPayload = unknown, TResult = unknown>(
    jobId: string,
  ): JobRecord<TPayload, TResult> | undefined {
    const row = this.database
      .prepare("SELECT * FROM jobs WHERE job_id = ?")
      .get(jobId) as SqlRow | undefined;
    return row ? mapJob<TPayload, TResult>(row) : undefined;
  }

  claimNextJob(
    workerId: string,
    startedAt = new Date().toISOString(),
  ): JobRecord | undefined {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const candidate = this.database
        .prepare(
          "SELECT job_id FROM jobs WHERE state = 'QUEUED' ORDER BY created_at, job_id LIMIT 1",
        )
        .get() as { job_id: string } | undefined;
      if (!candidate) {
        this.database.exec("COMMIT");
        return undefined;
      }
      const result = this.database
        .prepare(
          "UPDATE jobs SET state = 'RUNNING', worker_id = ?, attempt = attempt + 1, started_at = ?, finished_at = NULL, error_message = NULL WHERE job_id = ? AND state = 'QUEUED'",
        )
        .run(workerId, startedAt, candidate.job_id);
      this.database.exec("COMMIT");
      return result.changes === 1 ? this.getJob(candidate.job_id) : undefined;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  succeedJob(
    jobId: string,
    workerId: string,
    result: unknown,
    finishedAt = new Date().toISOString(),
  ): void {
    this.finish(
      jobId,
      workerId,
      "SUCCEEDED",
      JSON.stringify(result),
      null,
      finishedAt,
    );
  }

  failJob(
    jobId: string,
    workerId: string,
    errorMessage: string,
    finishedAt = new Date().toISOString(),
  ): void {
    this.finish(
      jobId,
      workerId,
      "FAILED",
      null,
      errorMessage.slice(0, 500),
      finishedAt,
    );
  }

  private finish(
    jobId: string,
    workerId: string,
    state: Extract<JobState, "SUCCEEDED" | "FAILED">,
    result: string | null,
    error: string | null,
    finishedAt: string,
  ): void {
    const update = this.database
      .prepare(
        "UPDATE jobs SET state = ?, result_json = ?, error_message = ?, finished_at = ? WHERE job_id = ? AND state = 'RUNNING' AND worker_id = ?",
      )
      .run(state, result, error, finishedAt, jobId, workerId);
    if (update.changes !== 1)
      throw new Error(
        `Job ${jobId} is not owned by ${workerId} in RUNNING state`,
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

function mapJob<TPayload, TResult>(row: SqlRow): JobRecord<TPayload, TResult> {
  return {
    jobId: String(row.job_id),
    kind: row.kind as JobRecord["kind"],
    state: row.state as JobState,
    payload: JSON.parse(String(row.payload_json)) as TPayload,
    result:
      row.result_json === null
        ? null
        : (JSON.parse(String(row.result_json)) as TResult),
    errorMessage: row.error_message === null ? null : String(row.error_message),
    idempotencyKey: String(row.idempotency_key),
    workerId: row.worker_id === null ? null : String(row.worker_id),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    createdAt: String(row.created_at),
    startedAt: row.started_at === null ? null : String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
  };
}
