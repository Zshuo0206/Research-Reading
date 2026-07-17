import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiRuntime } from "../../../apps/api/src/runtime.js";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";

const temporaryDirectories: string[] = [];
const provider = {
  provider: "CUSTOM_OPENAI_COMPATIBLE" as const,
  base_url: "https://fake-provider.test/v1",
  model: "fake-guided-v1",
  request_timeout_ms: 30_000,
  max_input_characters: 200_000,
  max_output_tokens: 2_000,
};

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe("Guided Learning feedback retry question pointers", () => {
  it("preserves the pointer from SUBMIT_ANSWER and RETRY through FEEDBACK_READY", async () => {
    const setup = await createSetup("retry-flow");
    const api = createApiRuntime(setup.databasePath, setup.contentRoot);
    createPaper(api, "proj_retry", "doc_retry", "docv_retry");
    let failFeedback = true;
    const worker = createWorkerRuntime(
      "retry-pointer-worker",
      setup.databasePath,
      {
        guidedLearningGateway: {
          invoke: async (request) => {
            const value = request as {
              operation: string;
              input?: {
                context_spans?: Array<{
                  context_span_id: string;
                  text: string;
                }>;
              };
            };
            if (value.operation === "GENERATE_GUIDED_DIRECTIONS")
              return response(value.operation, {
                directions: [
                  {
                    title: "方法",
                    description: "方法设计",
                    selection_basis: "目标匹配",
                  },
                  {
                    title: "证据",
                    description: "证据链",
                    selection_basis: "便于回查",
                  },
                ],
              });
            if (value.operation === "GENERATE_GUIDED_QUESTIONS")
              return response(value.operation, {
                questions: [
                  { text: "问题一？" },
                  { text: "问题二？" },
                  { text: "问题三？" },
                ],
              });
            if (value.operation === "GENERATE_GUIDED_FEEDBACK") {
              if (failFeedback) {
                failFeedback = false;
                throw new Error("temporary feedback failure");
              }
              const span = value.input?.context_spans?.[0];
              return response(value.operation, {
                status: "SUCCESS",
                summary: "点评完成",
                omissions: [],
                reference_answer: "方法证据",
                claims: [
                  {
                    text: "方法证据",
                    claim_type: "PAPER_FACT",
                    context_span_id: span?.context_span_id,
                    evidence_quote_candidate: span?.text,
                  },
                ],
              });
            }
            return response(value.operation, {
              key_mastery_points: ["方法"],
              major_weak_points: [],
              next_stage_hint: "继续复习",
            });
          },
        },
      },
    );
    const created = api.guidedLearningHandlers.create({
      project_id: "proj_retry",
      document_version_id: "docv_retry",
      learning_goal: "理解方法",
      provider_config: provider,
    });
    await worker.jobRuntime.runOnce();
    let session = api.guidedLearningRuntime.getSession(
      created.session.session_id,
    );
    const directionId = session.candidate_directions[0]?.direction_id;
    command(
      api,
      session.session_id,
      "SELECT_DIRECTION",
      { direction_id: directionId },
      "retry-select",
    );
    command(
      api,
      session.session_id,
      "START_STAGE",
      { stage_id: "UNDERSTAND" },
      "retry-start",
    );
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    const question = session.questions?.[0];
    const submitted = command(
      api,
      session.session_id,
      "SUBMIT_ANSWER",
      {
        question_id: question?.question_id,
        question_order: question?.order,
        answer: "我的回答",
      },
      "retry-submit",
    );
    const submittedJob = api.storage.getJob(submitted.job_id ?? "");
    expect(submittedJob?.payload).toMatchObject({
      operation: "GUIDED_LEARNING_FEEDBACK_GENERATION",
      question_id: question?.question_id,
      question_order: question?.order,
    });

    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    expect(session.state).toBe("RETRYABLE_FAILURE");
    expect(session.failure?.resume_state).toBe("ANSWER_SUBMITTED");

    const retried = command(
      api,
      session.session_id,
      "RETRY",
      {},
      "retry-feedback",
    );
    expect(retried.session.state).toBe("ANSWER_SUBMITTED");
    const retryJob = api.storage.getJob(retried.job_id ?? "");
    expect(retryJob?.payload).toMatchObject({
      operation: "GUIDED_LEARNING_FEEDBACK_GENERATION",
      question_id: question?.question_id,
      question_order: question?.order,
    });
    const replay = command(
      api,
      session.session_id,
      "RETRY",
      {},
      "retry-feedback",
    );
    expect(replay.session.session_revision).toBe(
      retried.session.session_revision,
    );
    expect(replay.job_id).toBe(retried.job_id);

    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    expect(session.state).toBe("FEEDBACK_READY");
    expect(session.questions?.[0]?.question_id).toBe(question?.question_id);

    const edited = command(
      api,
      session.session_id,
      "EDIT_ANSWER",
      {
        question_id: question?.question_id,
        question_order: question?.order,
        answer: "修改后的回答",
      },
      "retry-edit",
    );
    expect(api.storage.getJob(edited.job_id ?? "")?.payload).toMatchObject({
      operation: "GUIDED_LEARNING_FEEDBACK_GENERATION",
      question_id: question?.question_id,
      question_order: question?.order,
    });
    worker.database.close();
    api.database.close();
  });

  it("does not attach question pointers to directions, questions, or summary retries", () => {
    const api = createApiRuntime(":memory:");
    const directions = api.guidedLearningRuntime.createSession({
      project_id: "proj_direction_retry",
      document_version_id: "docv_direction_retry",
      learning_goal: "方向",
    });
    api.guidedLearningRuntime.recordFailure({
      session_id: directions.session_id,
      failed_operation: "GENERATE_DIRECTIONS",
      error_code: "TEMPORARY_UNAVAILABLE",
      message: "temporary",
      retryable: true,
    });
    const directionsRetry = command(
      api,
      directions.session_id,
      "RETRY",
      {},
      "retry-directions",
    );
    expect(
      api.storage.getJob(directionsRetry.job_id ?? "")?.payload,
    ).not.toHaveProperty("question_id");
    expect(
      api.storage.getJob(directionsRetry.job_id ?? "")?.payload,
    ).not.toHaveProperty("question_order");

    const questionsSession = api.guidedLearningRuntime.createSession({
      project_id: "proj_questions_retry",
      document_version_id: "docv_questions_retry",
      learning_goal: "问题",
    });
    const generatedDirections = api.guidedLearningRuntime.generateDirections(
      questionsSession.session_id,
    );
    command(
      api,
      questionsSession.session_id,
      "SELECT_DIRECTION",
      {
        direction_id: generatedDirections.candidate_directions[0]?.direction_id,
      },
      "retry-questions-select",
    );
    api.guidedLearningRuntime.recordFailure({
      session_id: questionsSession.session_id,
      failed_operation: "GENERATE_QUESTIONS",
      error_code: "TEMPORARY_UNAVAILABLE",
      message: "temporary",
      retryable: true,
    });
    const questionsRetry = command(
      api,
      questionsSession.session_id,
      "RETRY",
      {},
      "retry-questions",
    );
    expect(
      api.storage.getJob(questionsRetry.job_id ?? "")?.payload,
    ).not.toHaveProperty("question_id");
    expect(
      api.storage.getJob(questionsRetry.job_id ?? "")?.payload,
    ).not.toHaveProperty("question_order");
    const summarySession = api.guidedLearningRuntime.createSession({
      project_id: "proj_summary_retry",
      document_version_id: "docv_summary_retry",
      learning_goal: "总结",
    });
    const summaryDirections = api.guidedLearningRuntime.generateDirections(
      summarySession.session_id,
    );
    command(
      api,
      summarySession.session_id,
      "SELECT_DIRECTION",
      { direction_id: summaryDirections.candidate_directions[0]?.direction_id },
      "retry-summary-select",
    );
    command(
      api,
      summarySession.session_id,
      "START_STAGE",
      { stage_id: "UNDERSTAND" },
      "retry-summary-start",
    );
    api.guidedLearningRuntime.writeQuestions(
      summarySession.session_id,
      [1, 2, 3].map((order) => ({
        question_id: `summary_question_${order}`,
        order,
        stage_id: "UNDERSTAND" as const,
        prompt: `总结问题 ${order}`,
        status: "UNSEEN" as const,
        confirmation_status: "PENDING" as const,
      })),
    );
    const summaryQuestion = api.guidedLearningRuntime.getSession(
      summarySession.session_id,
    ).questions?.[0];
    command(
      api,
      summarySession.session_id,
      "SUBMIT_ANSWER",
      {
        question_id: summaryQuestion?.question_id,
        question_order: summaryQuestion?.order,
        answer: "总结回答",
      },
      "retry-summary-answer",
    );
    api.guidedLearningRuntime.writeFeedback({
      session_id: summarySession.session_id,
      feedback: { summary: "回答正确。", omissions: [] },
      reference_answer: {
        text: "总结参考答案",
        claims: [
          {
            text: "总结事实",
            claim_type: "PAPER_FACT",
            evidence_refs: ["summary_evidence_1"],
          },
        ],
      },
      evidence: [
        {
          evidence_span_id: "summary_evidence_1",
          context_span_id: "summary_context_1",
          document_version_id: "docv_summary_retry",
          page_number: 1,
          page_text_sha256: "hash",
          extraction_profile_version: "mock-v1",
          char_start: 0,
          char_end: 4,
          quote: "总结证据",
          verification_status: "VERIFIED",
        },
      ],
    });
    command(
      api,
      summarySession.session_id,
      "CONFIRM_QUESTION",
      {
        question_id: summaryQuestion?.question_id,
        question_order: summaryQuestion?.order,
      },
      "retry-summary-confirm",
    );
    api.guidedLearningRuntime.recordFailure({
      session_id: summarySession.session_id,
      failed_operation: "GENERATE_STAGE_SUMMARY",
      error_code: "TEMPORARY_UNAVAILABLE",
      message: "temporary",
      retryable: true,
    });
    const summaryRetry = command(
      api,
      summarySession.session_id,
      "RETRY",
      {},
      "retry-summary",
    );
    expect(
      api.storage.getJob(summaryRetry.job_id ?? "")?.payload,
    ).not.toHaveProperty("question_id");
    expect(
      api.storage.getJob(summaryRetry.job_id ?? "")?.payload,
    ).not.toHaveProperty("question_order");
    api.database.close();
  });

  it("rejects a feedback job without a pointer before invoking ModelGateway", async () => {
    const setup = await createSetup("missing-pointer");
    let calls = 0;
    const worker = createWorkerRuntime(
      "missing-pointer-worker",
      setup.databasePath,
      {
        guidedLearningGateway: {
          invoke: async () => {
            calls += 1;
            return {};
          },
        },
      },
    );
    const handler = worker.handlers.GUIDED_LEARNING_FEEDBACK_GENERATION;
    await expect(
      handler?.({
        schema_version: "guided-learning.v1",
        operation: "GUIDED_LEARNING_FEEDBACK_GENERATION",
        session_id: "learning_missing_pointer",
        project_id: "proj_missing_pointer",
        document_version_id: "docv_missing_pointer",
        learning_goal: "测试",
        expected_revision: 1,
        expected_state: "ANSWER_SUBMITTED",
        provider_config: provider,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Feedback generation job requires a question pointer",
    });
    expect(calls).toBe(0);
    worker.database.close();
  });
});

async function createSetup(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), `guided-${prefix}-`));
  temporaryDirectories.push(directory);
  return {
    databasePath: join(directory, "guided.sqlite"),
    contentRoot: join(directory, "content"),
  };
}

function createPaper(
  api: ReturnType<typeof createApiRuntime>,
  projectId: string,
  documentId: string,
  documentVersionId: string,
) {
  const text = "方法证据";
  const hash = createHash("sha256").update(text).digest("hex");
  api.storage.createProject(projectId, "Retry pointer");
  api.storage.createDocument(documentId, projectId, "paper.pdf");
  api.storage.createDocumentVersion({
    documentVersionId,
    documentId,
    sourceSha256: hash,
    pageCount: 1,
    extractionProfileVersion: "pdf-text-v1",
  });
  api.storage.saveDocumentPages(documentVersionId, [
    {
      pageNumber: 1,
      canonicalPageText: text,
      pageTextSha256: hash,
      extractionProfileVersion: "pdf-text-v1",
      codePointLength: Array.from(text).length,
    },
  ]);
}

function command(
  api: ReturnType<typeof createApiRuntime>,
  sessionId: string,
  event: string,
  payload: unknown,
  idempotencyKey: string,
) {
  return api.guidedLearningRuntime.executeCommand({
    session_id: sessionId,
    contract_version: "guided-learning.v1",
    event,
    payload,
    idempotency_key: idempotencyKey,
  });
}

function response(operation: string, output: unknown) {
  return {
    schema_version: "model-gateway.v1",
    message_kind: "RESPONSE",
    operation,
    output,
  };
}
