import { createApiServer } from "../../../apps/api/src/server.js";
import { GuidedLearningRuntimeError } from "../../../apps/api/src/guided-learning/runtime.js";
import { createApiRuntime } from "../../../apps/api/src/runtime.js";
import { GuidedLearningSessionRepository } from "../../../packages/storage/src/index.js";
import { describe, expect, it } from "vitest";

const makeRuntime = () => createApiRuntime(":memory:");
const makeFeedback = (
  documentVersionId: string,
  status: "VERIFIED" | "PENDING" = "VERIFIED",
) => ({
  feedback: { summary: "回答抓住了方法核心。", omissions: [] },
  reference_answer: {
    text: "方法通过模块化流程支持论文主张。",
    claims: [
      {
        text: "论文方法包含明确流程。",
        claim_type: "PAPER_FACT",
        evidence_refs: ["evidence_test_1"],
      },
    ],
  },
  evidence: [
    {
      evidence_span_id: "evidence_test_1",
      context_span_id: "context_test_1",
      document_version_id: documentVersionId,
      page_number: 1,
      page_text_sha256: "hash",
      extraction_profile_version: "mock-v1",
      char_start: 0,
      char_end: 4,
      quote: "方法流程",
      verification_status: status,
    },
  ],
});

describe("guided learning runtime", () => {
  it("runs migration and persists a session projection", () => {
    const rt = makeRuntime();
    const tables = (
      rt.database
        .prepare(
          "SELECT name FROM sqlite_master WHERE name LIKE 'guided_learning_%'",
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "guided_learning_sessions",
        "guided_learning_questions",
        "guided_learning_commands",
        "guided_learning_failures",
      ]),
    );
    const session = rt.guidedLearningRuntime.createSession({
      project_id: "proj_test",
      document_version_id: "docv_test",
      learning_goal: "理解方法",
    });
    rt.guidedLearningRuntime.generateDirections(session.session_id);
    expect(rt.guidedLearningRuntime.getSession(session.session_id).state).toBe(
      "AWAITING_DIRECTION_SELECTION",
    );
    rt.database.close();
  });

  it("replays an idempotent command without increasing revision", () => {
    const rt = makeRuntime();
    const created = rt.guidedLearningRuntime.createSession({
      project_id: "proj_test",
      document_version_id: "docv_test",
      learning_goal: "理解方法",
    });
    const directions = rt.guidedLearningRuntime.generateDirections(
      created.session_id,
    );
    const input = {
      session_id: created.session_id,
      contract_version: "guided-learning.v1",
      event: "SELECT_DIRECTION",
      payload: {
        direction_id: directions.candidate_directions[0]?.direction_id,
      },
      idempotency_key: "idem-select",
    };
    const first = rt.guidedLearningRuntime.executeCommand(input);
    expect(
      rt.guidedLearningRuntime.executeCommand(input).session.session_revision,
    ).toBe(first.session.session_revision);
    expect(() =>
      rt.guidedLearningRuntime.executeCommand({
        ...input,
        payload: {
          direction_id: directions.candidate_directions[1]?.direction_id,
        },
      }),
    ).toThrowError(GuidedLearningRuntimeError);
    try {
      rt.guidedLearningRuntime.executeCommand({
        ...input,
        payload: {
          direction_id: directions.candidate_directions[1]?.direction_id,
        },
      });
    } catch (error) {
      expect((error as GuidedLearningRuntimeError).code).toBe(
        "IDEMPOTENCY_CONFLICT",
      );
    }
    rt.database.close();
  });

  it("rejects optimistic revision conflicts", () => {
    const rt = makeRuntime();
    const session = rt.guidedLearningRuntime.createSession({
      project_id: "proj_test",
      document_version_id: "docv_test",
      learning_goal: "理解方法",
    });
    expect(() =>
      new GuidedLearningSessionRepository(rt.database).save(session, 99),
    ).toThrow();
    rt.database.close();
  });

  it("recomputes Evidence readiness on confirmation", () => {
    const rt = makeRuntime();
    const created = rt.guidedLearningRuntime.createSession({
      project_id: "proj_test",
      document_version_id: "docv_test",
      learning_goal: "理解方法",
    });
    const directions = rt.guidedLearningRuntime.generateDirections(
      created.session_id,
    );
    const command = (
      event: string,
      payload: unknown,
      idempotency_key: string,
    ) =>
      rt.guidedLearningRuntime.executeCommand({
        session_id: created.session_id,
        contract_version: "guided-learning.v1",
        event,
        payload,
        idempotency_key,
      });
    command(
      "SELECT_DIRECTION",
      { direction_id: directions.candidate_directions[0]?.direction_id },
      "idem-1",
    );
    command("START_STAGE", { stage_id: "UNDERSTAND" }, "idem-2");
    rt.guidedLearningRuntime.writeQuestions(created.session_id);
    const question = rt.guidedLearningRuntime.getSession(created.session_id)
      .questions?.[0];
    command(
      "SUBMIT_ANSWER",
      {
        question_id: question?.question_id,
        question_order: question?.order,
        answer: "我的回答",
      },
      "idem-3",
    );
    expect(() =>
      rt.guidedLearningRuntime.writeFeedback({
        session_id: created.session_id,
        ...makeFeedback("docv_test", "PENDING"),
      }),
    ).toThrowError(/EVIDENCE_NOT_VERIFIED/);
    expect(rt.guidedLearningRuntime.getSession(created.session_id).state).toBe(
      "ANSWER_SUBMITTED",
    );
    rt.guidedLearningRuntime.writeFeedback({
      session_id: created.session_id,
      ...makeFeedback("docv_test"),
    });
    expect(
      command(
        "CONFIRM_QUESTION",
        { question_id: question?.question_id, question_order: question?.order },
        "idem-4",
      ).session.state,
    ).toBe("QUESTION_COMPLETED");
    rt.database.close();
  });

  it("records retryable failure and restores its resume state", () => {
    const rt = makeRuntime();
    const session = rt.guidedLearningRuntime.createSession({
      project_id: "proj_test",
      document_version_id: "docv_test",
      learning_goal: "理解方法",
    });
    expect(
      rt.guidedLearningRuntime.recordFailure({
        session_id: session.session_id,
        failed_operation: "GENERATE_DIRECTIONS",
        error_code: "TEMPORARY_UNAVAILABLE",
        message: "mock unavailable",
        retryable: true,
      }).state,
    ).toBe("RETRYABLE_FAILURE");
    const result = rt.guidedLearningRuntime.executeCommand({
      session_id: session.session_id,
      contract_version: "guided-learning.v1",
      event: "RETRY",
      payload: {},
      idempotency_key: "idem-retry",
    });
    expect(result.session.state).toBe("CREATED");
    expect(result.session.failure).toBeUndefined();
    rt.database.close();
  });

  it("serves create, get and command HTTP routes", async () => {
    const app = createApiServer({ databasePath: ":memory:" });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/guided-learning/sessions",
      payload: {
        project_id: "proj_api",
        document_version_id: "docv_api",
        learning_goal: "理解方法",
      },
    });
    expect(created.statusCode).toBe(200);
    const session = (
      created.json() as {
        data: {
          session_id: string;
          candidate_directions: Array<{ direction_id: string }>;
        };
      }
    ).data;
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/guided-learning/sessions/${session.session_id}`,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/guided-learning/sessions/${session.session_id}/commands`,
          payload: {
            contract_version: "guided-learning.v1",
            event: "SELECT_DIRECTION",
            payload: {
              direction_id: session.candidate_directions[0]?.direction_id,
            },
            idempotency_key: "api-idem",
          },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/guided-learning/sessions/learning_missing",
        })
      ).statusCode,
    ).toBe(404);
    await app.close();
  });
});
