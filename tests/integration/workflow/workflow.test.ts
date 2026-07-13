import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  type WorkflowIds,
  WorkflowService,
} from "../../../apps/api/src/workflow/service.js";
import type {
  AnswerDraft,
  CanonicalPage,
  ContextSpan,
  QuestionPlanDraft,
} from "../../../apps/api/src/workflow/types.js";
import { JobRuntime } from "../../../apps/worker/src/runtime/job-runtime.js";
import {
  createAnswerGenerationJobHandler,
  createQuestionPlanJobHandler,
} from "../../../apps/worker/src/workflow/handlers.js";
import { MockModelGateway } from "../../../packages/model-gateway/src/index.js";
import {
  openDatabase,
  StorageRepository,
  WorkflowRepository,
  WorkflowStorageError,
} from "../../../packages/storage/src/index.js";

const workflowMigrations = resolve("apps/api/migrations");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function createFixture(): {
  database: DatabaseSync;
  storage: StorageRepository;
  workflow: WorkflowRepository;
  service: WorkflowService;
  page: CanonicalPage;
  span: ContextSpan;
  path: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "workflow-test-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "workflow.sqlite");
  const database = openDatabase(path, {
    migrationsDirectory: workflowMigrations,
  });
  const storage = new StorageRepository(database);
  const workflow = new WorkflowRepository(database);
  storage.createProject("proj_workflow", "Methods");
  storage.createDocument("doc_workflow", "proj_workflow", "Paper");
  storage.createDocumentVersion({
    documentVersionId: "docv_workflow",
    documentId: "doc_workflow",
    sourceSha256: "a".repeat(64),
    pageCount: 1,
    extractionProfileVersion: "pdfjs-text-v1",
  });
  const canonicalText = "Methods 😀 are described and evaluated.";
  const page: CanonicalPage = {
    document_version_id: "docv_workflow",
    page_number: 1,
    canonical_page_text: canonicalText,
    page_text_sha256: sha256(canonicalText),
    extraction_profile_version: "pdfjs-text-v1",
  };
  const span: ContextSpan = {
    context_span_id: "context_methods",
    document_version_id: "docv_workflow",
    page_number: 1,
    char_start: 0,
    char_end: 9,
    text: "Methods 😀",
    page_text_sha256: page.page_text_sha256,
    extraction_profile_version: page.extraction_profile_version,
  };
  return {
    database,
    storage,
    workflow,
    service: new WorkflowService(
      storage,
      workflow,
      sequenceIds(),
      () => "2026-07-13T00:00:00.000Z",
    ),
    page,
    span,
    path,
  };
}

describe("question and answer workflow", () => {
  it("runs both Jobs, enforces confirmed-question gating, and materializes verified EvidenceSpan", async () => {
    const fixture = createFixture();
    const blockedDraft = fixture.service.materializeQuestionPlan(
      questionPayload(fixture.span),
      questionDraft(),
    )[0];
    expect(() =>
      fixture.service.enqueueAnswer({
        questionId: blockedDraft.questionId,
        contextSpans: [fixture.span],
        canonicalPages: [fixture.page],
        pageCount: 1,
        providerConfig: { provider: "MOCK", fixture_id: "answer-success" },
        idempotencyKey: "answer-before-confirm",
      }),
    ).toThrowError(expect.objectContaining({ code: "CONFLICT" }));

    const questionJob = fixture.service.enqueueQuestionPlan({
      documentVersionId: "docv_workflow",
      documentLanguage: "en",
      pageCount: 1,
      contextSpans: [fixture.span],
      canonicalPages: [fixture.page],
      providerConfig: { provider: "MOCK", fixture_id: "question-default" },
      idempotencyKey: "question-job-one",
    });
    expect(
      fixture.service.enqueueQuestionPlan({
        documentVersionId: "docv_workflow",
        documentLanguage: "en",
        pageCount: 1,
        contextSpans: [fixture.span],
        canonicalPages: [fixture.page],
        providerConfig: { provider: "MOCK", fixture_id: "question-default" },
        idempotencyKey: "question-job-one",
      }).jobId,
    ).toBe(questionJob.jobId);

    const gateway = new MockModelGateway();
    const runtime = new JobRuntime(fixture.storage, "worker_workflow", {
      QUESTION_PLAN: createQuestionPlanJobHandler(gateway),
      ANSWER_GENERATION: createAnswerGenerationJobHandler(gateway),
    });
    expect(await runtime.runOnce()).toBe(true);
    const completedQuestionJob = fixture.storage.getJob<
      ReturnType<typeof questionPayload>,
      QuestionPlanDraft
    >(questionJob.jobId);
    expect(completedQuestionJob?.state).toBe("SUCCEEDED");
    if (!completedQuestionJob?.result)
      throw new Error("Question Job did not persist its result");
    const question = fixture.service.materializeQuestionPlan(
      completedQuestionJob.payload,
      completedQuestionJob.result,
    )[0];
    const confirmed = fixture.service.confirmQuestion(
      question.questionId,
      question.currentRevisionId,
    );
    expect(confirmed.reviewStatus).toBe("CONFIRMED");

    const answerJob = fixture.service.enqueueAnswer({
      questionId: confirmed.questionId,
      contextSpans: [fixture.span],
      canonicalPages: [fixture.page],
      pageCount: 1,
      providerConfig: { provider: "MOCK", fixture_id: "answer-success" },
      idempotencyKey: "answer-job-one",
    });
    expect(await runtime.runOnce()).toBe(true);
    const completedAnswerJob = fixture.storage.getJob<
      ReturnType<typeof answerPayload>,
      AnswerDraft
    >(answerJob.jobId);
    expect(completedAnswerJob?.state).toBe("SUCCEEDED");
    if (!completedAnswerJob?.result)
      throw new Error("Answer Job did not persist its result");
    const answer = fixture.service.materializeAnswer(
      completedAnswerJob.payload,
      completedAnswerJob.result,
      [fixture.page],
    );
    expect(answer).toMatchObject({
      reviewStatus: "DRAFT",
      verificationStatus: "VERIFIED",
    });
    const evidence = fixture.workflow.getEvidenceForRevision(
      answer.currentRevisionId,
    );
    expect(evidence).toEqual([
      expect.objectContaining({
        contextSpanId: fixture.span.context_span_id,
        quote: fixture.span.text,
        charStart: fixture.span.char_start,
        charEnd: fixture.span.char_end,
        verificationStatus: "VERIFIED",
      }),
    ]);
    expect(
      fixture.service.confirmAnswer(answer.answerId, answer.currentRevisionId)
        .reviewStatus,
    ).toBe("CONFIRMED");
    fixture.database.close();
  });

  it("applies immutable revision state machines for edit, confirm, and reject", () => {
    const fixture = createFixture();
    const question = fixture.service.materializeQuestionPlan(
      questionPayload(fixture.span),
      questionDraft(),
    )[0];
    const edited = fixture.service.editQuestion(
      question.questionId,
      question.currentRevisionId,
      "Which method was evaluated?",
    );
    expect(edited).toMatchObject({
      reviewStatus: "DRAFT",
      revision: {
        revisionNumber: 2,
        supersedesRevisionId: question.currentRevisionId,
        createdBy: "LOCAL_OPERATOR",
      },
    });
    const rejected = fixture.service.rejectQuestion(
      edited.questionId,
      edited.currentRevisionId,
    );
    expect(rejected.reviewStatus).toBe("REJECTED");
    expect(() =>
      fixture.service.confirmQuestion(
        rejected.questionId,
        rejected.currentRevisionId,
      ),
    ).toThrow(WorkflowStorageError);

    const revived = fixture.service.editQuestion(
      rejected.questionId,
      rejected.currentRevisionId,
      "What method supports the result?",
    );
    const confirmed = fixture.service.confirmQuestion(
      revived.questionId,
      revived.currentRevisionId,
    );
    fixture.service.enqueueAnswer({
      questionId: confirmed.questionId,
      contextSpans: [fixture.span],
      canonicalPages: [fixture.page],
      pageCount: 1,
      providerConfig: { provider: "MOCK", fixture_id: "answer-success" },
      idempotencyKey: "state-answer",
    });
    const answer = fixture.service.materializeAnswer(
      answerPayload(confirmed, fixture.span),
      successAnswerDraft(),
      [fixture.page],
    );
    const editedAnswer = fixture.service.editAnswer({
      answerId: answer.answerId,
      expectedRevisionId: answer.currentRevisionId,
      draft: {
        status: "SUCCESS",
        claims: [
          {
            text: "The operator clarified the supported method.",
            claim_type: "AGENT_INFERENCE",
            candidate_context_span_ids: [fixture.span.context_span_id],
          },
        ],
      },
      contextSpans: [fixture.span],
      canonicalPages: [fixture.page],
    });
    expect(editedAnswer).toMatchObject({
      reviewStatus: "DRAFT",
      verificationStatus: "VERIFIED",
      revision: {
        revisionNumber: 2,
        supersedesRevisionId: answer.currentRevisionId,
        createdBy: "LOCAL_OPERATOR",
      },
    });
    expect(
      fixture.service.rejectAnswer(
        editedAnswer.answerId,
        editedAnswer.currentRevisionId,
      ).reviewStatus,
    ).toBe("REJECTED");
    fixture.database.close();
  });

  it("rejects invalid candidate ContextSpans and unknown candidate references", () => {
    const fixture = createFixture();
    const invalid = { ...fixture.span, char_end: 8 };
    expect(() =>
      fixture.service.enqueueQuestionPlan({
        documentVersionId: "docv_workflow",
        documentLanguage: "en",
        pageCount: 1,
        contextSpans: [invalid],
        canonicalPages: [fixture.page],
        providerConfig: { provider: "MOCK", fixture_id: "question-default" },
        idempotencyKey: "bad-context",
      }),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));

    const question = fixture.service.materializeQuestionPlan(
      questionPayload(fixture.span),
      questionDraft(),
    )[0];
    const confirmed = fixture.service.confirmQuestion(
      question.questionId,
      question.currentRevisionId,
    );
    fixture.workflow.saveContextSpans([toStored(fixture.span)]);
    expect(() =>
      fixture.service.materializeAnswer(
        answerPayload(confirmed, fixture.span),
        {
          status: "SUCCESS",
          claims: [
            {
              text: "Unsupported",
              claim_type: "PAPER_FACT",
              candidate_context_span_ids: ["context_missing"],
            },
          ],
        },
        [fixture.page],
      ),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    fixture.database.close();
  });

  it("persists the explicit insufficient-evidence path and prevents confirmation", () => {
    const fixture = createFixture();
    const question = fixture.service.materializeQuestionPlan(
      questionPayload(fixture.span),
      questionDraft(),
    )[0];
    const confirmed = fixture.service.confirmQuestion(
      question.questionId,
      question.currentRevisionId,
    );
    fixture.workflow.saveContextSpans([toStored(fixture.span)]);
    const answer = fixture.service.materializeAnswer(
      answerPayload(confirmed, fixture.span),
      {
        status: "INSUFFICIENT_EVIDENCE",
        claims: [
          {
            text: "The supplied excerpt is insufficient.",
            claim_type: "INSUFFICIENT_EVIDENCE",
            candidate_context_span_ids: [],
          },
        ],
      },
      [fixture.page],
    );
    expect(answer.verificationStatus).toBe("INSUFFICIENT_EVIDENCE");
    expect(
      fixture.workflow.getEvidenceForRevision(answer.currentRevisionId),
    ).toEqual([]);
    expect(() =>
      fixture.service.confirmAnswer(answer.answerId, answer.currentRevisionId),
    ).toThrowError(expect.objectContaining({ code: "INVALID_TRANSITION" }));
    expect(
      fixture.service.rejectAnswer(answer.answerId, answer.currentRevisionId)
        .reviewStatus,
    ).toBe("REJECTED");
    fixture.database.close();
  });

  it("reads questions, answers, revisions, and evidence after reconnecting", () => {
    const fixture = createFixture();
    const question = fixture.service.materializeQuestionPlan(
      questionPayload(fixture.span),
      questionDraft(),
    )[0];
    const confirmed = fixture.service.confirmQuestion(
      question.questionId,
      question.currentRevisionId,
    );
    fixture.workflow.saveContextSpans([toStored(fixture.span)]);
    const answer = fixture.service.materializeAnswer(
      answerPayload(confirmed, fixture.span),
      successAnswerDraft(),
      [fixture.page],
    );
    fixture.database.close();

    const reopened = openDatabase(fixture.path, {
      migrationsDirectory: workflowMigrations,
    });
    const workflow = new WorkflowRepository(reopened);
    expect(workflow.getQuestion(question.questionId)).toMatchObject({
      reviewStatus: "CONFIRMED",
      revision: { text: question.revision.text },
    });
    expect(workflow.getAnswer(answer.answerId)).toMatchObject({
      verificationStatus: "VERIFIED",
      revision: {
        claims: [expect.objectContaining({ claimType: "PAPER_FACT" })],
      },
    });
    expect(
      workflow.getEvidenceForRevision(answer.currentRevisionId),
    ).toHaveLength(1);
    expect(
      reopened
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all(),
    ).toEqual([{ version: 1 }, { version: 2 }]);
    reopened.close();
  });
});

function sequenceIds(): WorkflowIds {
  let sequence = 0;
  const next = (prefix: string) => `${prefix}_${++sequence}`;
  return {
    job: () => next("job"),
    questionPlan: () => next("qplan"),
    question: () => next("question"),
    questionRevision: () => next("qrev"),
    answer: () => next("answer"),
    answerRevision: () => next("arev"),
    claim: () => next("claim"),
    evidence: () => next("evidence"),
  };
}

function questionPayload(span: ContextSpan) {
  return {
    documentVersionId: "docv_workflow",
    documentLanguage: "en",
    pageCount: 1,
    contextSpans: [span],
    providerConfig: {
      provider: "MOCK" as const,
      fixture_id: "question-default",
    },
  };
}

function questionDraft(): QuestionPlanDraft {
  return {
    document_language: "en",
    retrieval_queries: ["research method"],
    retrieval_terms: ["method"],
    questions: [{ text: "What method was used?" }],
  };
}

function answerPayload(
  question: {
    questionId: string;
    currentRevisionId: string;
    revision: { text: string };
  },
  span: ContextSpan,
) {
  return {
    question: {
      questionId: question.questionId,
      revisionId: question.currentRevisionId,
      text: question.revision.text,
    },
    documentVersionId: "docv_workflow",
    pageCount: 1,
    contextSpans: [span],
    providerConfig: { provider: "MOCK" as const, fixture_id: "answer-success" },
  };
}

function successAnswerDraft(): AnswerDraft {
  return {
    status: "SUCCESS",
    claims: [
      {
        text: "The paper describes and evaluates a method.",
        claim_type: "PAPER_FACT",
        candidate_context_span_ids: ["context_methods"],
      },
    ],
  };
}

function toStored(span: ContextSpan) {
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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
