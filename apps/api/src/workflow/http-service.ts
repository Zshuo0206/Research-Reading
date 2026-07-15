import type { DatabaseSync } from "node:sqlite";
import type {
  StorageRepository,
  WorkflowRepository,
} from "../../../../packages/storage/dist/index.js";
import type { DocumentImportPayload } from "../document-ingest/service.js";
import type { WorkflowService } from "./service.js";
import type {
  AnswerDraft,
  AnswerGenerationJobPayload,
  CanonicalPage,
  ContextSpan,
  ProviderConfig,
  QuestionPlanDraft,
  QuestionPlanJobPayload,
} from "./types.js";

type StoredJob = {
  job_id: string;
  kind: "DOCUMENT_IMPORT" | "QUESTION_PLAN" | "ANSWER_GENERATION";
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  payload_json: string;
  result_json: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export class WorkflowHttpError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "DOCUMENT_NOT_READY"
      | "JOB_FAILED"
      | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "WorkflowHttpError";
  }
}

export class WorkflowHttpService {
  constructor(
    private readonly database: DatabaseSync,
    private readonly storage: StorageRepository,
    private readonly workflow: WorkflowRepository,
    private readonly service: WorkflowService,
  ) {}

  getProject(projectId: string) {
    const project = this.storage.getProject(projectId);
    if (!project) throw new WorkflowHttpError("NOT_FOUND", "Project not found");
    return project;
  }

  createProject(name: string) {
    if (name.trim().length === 0)
      throw new WorkflowHttpError(
        "VALIDATION_ERROR",
        "Project name is required",
      );
    const projectId = `proj_${crypto.randomUUID()}`;
    this.storage.createProject(projectId, name.trim());
    return this.getProject(projectId);
  }

  getDocument(documentId: string) {
    const row = this.database
      .prepare("SELECT * FROM documents WHERE document_id = ?")
      .get(documentId) as Record<string, unknown> | undefined;
    if (!row) throw new WorkflowHttpError("NOT_FOUND", "Document not found");
    const job = this.findDocumentJob(documentId);
    if (job?.state === "SUCCEEDED") this.finalizeDocumentImport(job);
    return {
      document_id: row.document_id,
      project_id: row.project_id,
      title: row.title,
      created_at: row.created_at,
      document_version: job ? this.documentVersionForJob(job) : null,
      extraction_job: job ? this.publicJob(job) : null,
    };
  }

  getJob(jobId: string) {
    const job = this.readJob(jobId);
    if (!job) throw new WorkflowHttpError("NOT_FOUND", "Job not found");
    if (job.state === "SUCCEEDED") this.materializeJob(job);
    return this.publicJob(this.readJob(jobId) ?? job);
  }

  enqueueQuestionPlan(input: {
    documentVersionId: string;
    documentLanguage: string;
    providerConfig: ProviderConfig;
    idempotencyKey: string;
  }) {
    const document = this.ensureDocumentReady(input.documentVersionId);
    const pages = document.pages;
    return this.service.enqueueQuestionPlan({
      documentVersionId: input.documentVersionId,
      documentLanguage: input.documentLanguage,
      pageCount: document.pageCount,
      contextSpans: contextSpans(input.documentVersionId, pages),
      canonicalPages: pages,
      providerConfig: input.providerConfig,
      idempotencyKey: input.idempotencyKey,
    });
  }

  getQuestionPlan(documentVersionId: string) {
    const plan = this.database
      .prepare(
        "SELECT * FROM question_plans WHERE document_version_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(documentVersionId) as Record<string, unknown> | undefined;
    if (!plan)
      throw new WorkflowHttpError("NOT_FOUND", "Question plan not found");
    const questions = (
      this.database
        .prepare("SELECT question_id FROM questions WHERE question_plan_id = ?")
        .all(String(plan.question_plan_id)) as Array<{ question_id: string }>
    ).flatMap((row) => {
      const question = this.workflow.getQuestion(row.question_id);
      return question ? [question] : [];
    });
    return {
      question_plan_id: plan.question_plan_id,
      document_version_id: plan.document_version_id,
      document_language: plan.document_language,
      retrieval_queries: parseJson(plan.retrieval_queries_json, []),
      retrieval_terms: parseJson(plan.retrieval_terms_json, []),
      questions,
    };
  }

  getQuestion(questionId: string) {
    const question = this.workflow.getQuestion(questionId);
    if (!question)
      throw new WorkflowHttpError("NOT_FOUND", "Question not found");
    return question;
  }

  enqueueAnswer(input: {
    questionId: string;
    providerConfig: ProviderConfig;
    idempotencyKey: string;
  }) {
    const question = this.getQuestion(input.questionId);
    const document = this.ensureDocumentReady(question.documentVersionId);
    return this.service.enqueueAnswer({
      questionId: input.questionId,
      contextSpans: contextSpans(question.documentVersionId, document.pages),
      canonicalPages: document.pages,
      pageCount: document.pageCount,
      providerConfig: input.providerConfig,
      idempotencyKey: input.idempotencyKey,
    });
  }

  getAnswer(answerId: string) {
    const answer = this.workflow.getAnswer(answerId);
    if (!answer) throw new WorkflowHttpError("NOT_FOUND", "Answer not found");
    return {
      ...answer,
      evidence: this.workflow.getEvidenceForRevision(answer.currentRevisionId),
    };
  }

  editAnswer(input: {
    answerId: string;
    expectedRevisionId: string;
    draft: AnswerDraft;
  }) {
    const answer = this.getAnswer(input.answerId);
    const question = this.getQuestion(answer.questionId);
    const document = this.ensureDocumentReady(question.documentVersionId);
    return this.service.editAnswer({
      answerId: input.answerId,
      expectedRevisionId: input.expectedRevisionId,
      draft: input.draft,
      contextSpans: contextSpans(question.documentVersionId, document.pages),
      canonicalPages: document.pages,
    });
  }

  getProjectSnapshot(projectId: string) {
    const project = this.getProject(projectId);
    const documents = (
      this.database
        .prepare(
          "SELECT document_id FROM documents WHERE project_id = ? ORDER BY created_at",
        )
        .all(projectId) as Array<{ document_id: string }>
    ).map((row) => this.getDocument(row.document_id));
    const documentVersions = documents.flatMap((document) =>
      document.document_version ? [document.document_version] : [],
    );
    const plans = documentVersions.flatMap((version) => {
      try {
        return [this.getQuestionPlan(String(version.document_version_id))];
      } catch {
        return [];
      }
    });
    const answers = plans.flatMap((plan) =>
      plan.questions.flatMap((question) => {
        const rows = this.database
          .prepare("SELECT answer_id FROM answers WHERE question_id = ?")
          .all(question.questionId) as Array<{ answer_id: string }>;
        return rows.map((row) => this.getAnswer(row.answer_id));
      }),
    );
    return { project, documents, question_plans: plans, answers };
  }

  private materializeJob(job: StoredJob): void {
    if (job.kind === "DOCUMENT_IMPORT") {
      this.finalizeDocumentImport(job);
      return;
    }
    const result = parseJson<unknown>(job.result_json, null);
    if (isRecord(result) && result.materialized === true) return;
    if (job.kind === "QUESTION_PLAN") {
      const questions = this.service.materializeQuestionPlan(
        parseJson(job.payload_json, {}) as QuestionPlanJobPayload,
        result as QuestionPlanDraft,
      );
      this.updateResult(job.job_id, {
        materialized: true,
        question_plan_id: questions[0]?.questionPlanId,
        question_ids: questions.map((question) => question.questionId),
      });
      return;
    }
    const payload = parseJson(
      job.payload_json,
      {},
    ) as AnswerGenerationJobPayload;
    const document = this.ensureDocumentReady(payload.documentVersionId);
    const answer = this.service.materializeAnswer(
      payload,
      result as AnswerDraft,
      document.pages,
    );
    this.updateResult(job.job_id, {
      materialized: true,
      answer_id: answer.answerId,
      verification_status: answer.verificationStatus,
    });
  }

  private finalizeDocumentImport(job: StoredJob): void {
    const result = parseJson<unknown>(job.result_json, null);
    if (!isExtractedDocument(result))
      throw new WorkflowHttpError(
        "JOB_FAILED",
        "Document extraction result is invalid",
      );
    const payload = parseJson(job.payload_json, {}) as DocumentImportPayload;
    if (!payload.documentVersionId || !payload.documentId)
      throw new WorkflowHttpError(
        "JOB_FAILED",
        "Document extraction payload is invalid",
      );
    if (!this.storage.getDocumentVersion(payload.documentVersionId)) {
      this.storage.createDocumentVersion({
        documentVersionId: payload.documentVersionId,
        documentId: payload.documentId,
        sourceSha256: result.source_sha256,
        pageCount: result.page_count,
        extractionProfileVersion: result.extraction_profile.version,
      });
    }
    this.storage.saveDocumentPages(
      payload.documentVersionId,
      result.pages.map((page) => ({
        pageNumber: page.page_number,
        canonicalPageText: page.canonical_page_text,
        pageTextSha256: page.canonical_page_text_sha256,
        extractionProfileVersion: result.extraction_profile.version,
        codePointLength: page.code_point_length,
      })),
    );
  }

  private ensureDocumentReady(documentVersionId: string): {
    pageCount: number;
    pages: CanonicalPage[];
  } {
    const job = this.findDocumentJobByVersion(documentVersionId);
    if (!job)
      throw new WorkflowHttpError("NOT_FOUND", "Document version not found");
    if (job.state === "FAILED")
      throw new WorkflowHttpError("JOB_FAILED", "Document extraction failed");
    if (job.state !== "SUCCEEDED")
      throw new WorkflowHttpError(
        "DOCUMENT_NOT_READY",
        "Document extraction is not complete",
      );
    this.finalizeDocumentImport(job);
    const result = parseJson<unknown>(job.result_json, null);
    if (!isExtractedDocument(result))
      throw new WorkflowHttpError(
        "JOB_FAILED",
        "Document extraction result is invalid",
      );
    return {
      pageCount: result.page_count,
      pages: result.pages.map((page) => ({
        document_version_id: documentVersionId,
        page_number: page.page_number,
        canonical_page_text: page.canonical_page_text,
        page_text_sha256: page.canonical_page_text_sha256,
        extraction_profile_version: result.extraction_profile.version,
      })),
    };
  }

  private findDocumentJob(documentId: string): StoredJob | undefined {
    return this.allJobs().find((job) => {
      const payload = parseJson(job.payload_json, {}) as DocumentImportPayload;
      return (
        job.kind === "DOCUMENT_IMPORT" && payload.documentId === documentId
      );
    });
  }

  private findDocumentJobByVersion(
    documentVersionId: string,
  ): StoredJob | undefined {
    return this.allJobs().find((job) => {
      const payload = parseJson(job.payload_json, {}) as DocumentImportPayload;
      return (
        job.kind === "DOCUMENT_IMPORT" &&
        payload.documentVersionId === documentVersionId
      );
    });
  }

  private allJobs(): StoredJob[] {
    return this.database
      .prepare("SELECT * FROM jobs ORDER BY created_at, job_id")
      .all() as StoredJob[];
  }

  private readJob(jobId: string): StoredJob | undefined {
    return this.database
      .prepare("SELECT * FROM jobs WHERE job_id = ?")
      .get(jobId) as StoredJob | undefined;
  }

  private updateResult(jobId: string, result: unknown): void {
    this.database
      .prepare("UPDATE jobs SET result_json = ? WHERE job_id = ?")
      .run(JSON.stringify(result), jobId);
  }

  private documentVersionForJob(job: StoredJob) {
    const payload = parseJson(job.payload_json, {}) as DocumentImportPayload;
    const version = this.storage.getDocumentVersion(payload.documentVersionId);
    return version
      ? {
          document_version_id: version.document_version_id,
          page_count: version.page_count,
          extraction_profile_version: version.extraction_profile_version,
        }
      : null;
  }

  private publicJob(job: StoredJob) {
    const payload = parseJson(job.payload_json, {}) as Record<string, unknown>;
    return {
      job_id: job.job_id,
      job_type: job.kind,
      status: job.state,
      related: relatedIds(payload),
      error:
        job.state === "FAILED"
          ? { code: "JOB_FAILED", message: "The background job failed safely" }
          : null,
      created_at: job.created_at,
      updated_at: job.finished_at ?? job.started_at ?? job.created_at,
    };
  }
}

function contextSpans(
  documentVersionId: string,
  pages: readonly CanonicalPage[],
): ContextSpan[] {
  return pages
    .filter((page) => page.canonical_page_text.length > 0)
    .map((page) => ({
      context_span_id: `context_${documentVersionId.slice(5)}_${page.page_number}`,
      document_version_id: documentVersionId,
      page_number: page.page_number,
      char_start: 0,
      char_end: Array.from(page.canonical_page_text).length,
      text: page.canonical_page_text,
      page_text_sha256: page.page_text_sha256,
      extraction_profile_version: page.extraction_profile_version,
    }));
}

function relatedIds(payload: Record<string, unknown>) {
  return {
    project_id:
      typeof payload.projectId === "string" ? payload.projectId : null,
    document_id:
      typeof payload.documentId === "string" ? payload.documentId : null,
    document_version_id:
      typeof payload.documentVersionId === "string"
        ? payload.documentVersionId
        : null,
    question_id:
      isRecord(payload.question) &&
      typeof payload.question.questionId === "string"
        ? payload.question.questionId
        : null,
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isExtractedDocument(value: unknown): value is {
  source_sha256: string;
  page_count: number;
  extraction_profile: { version: string };
  pages: Array<{
    page_number: number;
    canonical_page_text: string;
    canonical_page_text_sha256: string;
    code_point_length: number;
  }>;
} {
  return (
    isRecord(value) &&
    typeof value.source_sha256 === "string" &&
    typeof value.page_count === "number" &&
    isRecord(value.extraction_profile) &&
    typeof value.extraction_profile.version === "string" &&
    Array.isArray(value.pages) &&
    value.pages.every(
      (page) =>
        isRecord(page) &&
        typeof page.page_number === "number" &&
        typeof page.canonical_page_text === "string" &&
        typeof page.canonical_page_text_sha256 === "string" &&
        typeof page.code_point_length === "number",
    )
  );
}
