import { createApiServer } from "../../../apps/api/src/server.js";
import { GuidedLearningRuntimeError } from "../../../apps/api/src/guided-learning/runtime.js";
import { createApiRuntime } from "../../../apps/api/src/runtime.js";
import { GuidedLearningSessionRepository } from "../../../packages/storage/src/index.js";
import { describe, expect, it } from "vitest";

const makeRuntime = () => createApiRuntime(":memory:");
const makeFeedback = (
  documentVersionId: string,
  status:
    | "VERIFIED"
    | "PENDING"
    | "INVALID"
    | "INSUFFICIENT_EVIDENCE" = "VERIFIED",
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

function prepareAnsweredSession(
  rt: ReturnType<typeof makeRuntime>,
  questionPrefix = "question_mock",
) {
  const created = rt.guidedLearningRuntime.createSession({
    project_id: "proj_test",
    document_version_id: "docv_test",
    learning_goal: "理解方法",
  });
  const directions = rt.guidedLearningRuntime.generateDirections(
    created.session_id,
  );
  const command = (event: string, payload: unknown, idempotency_key: string) =>
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
    `${created.session_id}-select`,
  );
  command(
    "START_STAGE",
    { stage_id: "UNDERSTAND" },
    `${created.session_id}-start`,
  );
  rt.guidedLearningRuntime.writeQuestions(
    created.session_id,
    [1, 2, 3].map((order) => ({
      question_id: `${questionPrefix}_${order}`,
      order,
      stage_id: "UNDERSTAND",
      prompt: `问题 ${order}`,
      status: "UNSEEN",
      confirmation_status: "PENDING",
    })),
  );
  const question = rt.guidedLearningRuntime.getSession(created.session_id)
    .questions?.[0];
  command(
    "SUBMIT_ANSWER",
    {
      question_id: question?.question_id,
      question_order: question?.order,
      answer: "我的回答",
    },
    `${created.session_id}-answer`,
  );
  return { sessionId: created.session_id, question, command };
}

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
    expect(
      rt.database
        .prepare(
          "SELECT result_revision FROM guided_learning_commands WHERE idempotency_key = ?",
        )
        .get("idem-retry"),
    ).toEqual({ result_revision: result.session.session_revision });
    expect(
      rt.database
        .prepare(
          "SELECT superseded_at FROM guided_learning_failures WHERE session_id = ?",
        )
        .get(session.session_id),
    ).not.toEqual({ superseded_at: null });
    const replay = rt.guidedLearningRuntime.executeCommand({
      session_id: session.session_id,
      contract_version: "guided-learning.v1",
      event: "RETRY",
      payload: {},
      idempotency_key: "idem-retry",
    });
    expect(replay.session.session_revision).toBe(
      result.session.session_revision,
    );
    rt.database.close();
  });

  it("atomically supersedes failures with RETRY and rolls back on supersede failure", () => {
    const rt = makeRuntime();
    const session = rt.guidedLearningRuntime.createSession({
      project_id: "proj_atomic",
      document_version_id: "docv_atomic",
      learning_goal: "理解方法",
    });
    rt.guidedLearningRuntime.recordFailure({
      session_id: session.session_id,
      failed_operation: "GENERATE_DIRECTIONS",
      error_code: "TEMPORARY_UNAVAILABLE",
      message: "mock unavailable",
      retryable: true,
    });
    const before = rt.guidedLearningRuntime.getSession(session.session_id);
    rt.database.exec(
      `CREATE TRIGGER reject_guided_failure_supersede
       BEFORE UPDATE OF superseded_at ON guided_learning_failures
       BEGIN SELECT RAISE(ABORT, 'supersede blocked'); END`,
    );
    expect(() =>
      rt.guidedLearningRuntime.executeCommand({
        session_id: session.session_id,
        contract_version: "guided-learning.v1",
        event: "RETRY",
        payload: {},
        idempotency_key: "idem-atomic-retry",
      }),
    ).toThrow();
    const after = rt.guidedLearningRuntime.getSession(session.session_id);
    expect(after).toMatchObject({
      state: before.state,
      session_revision: before.session_revision,
    });
    expect(
      rt.database
        .prepare(
          "SELECT COUNT(*) AS count FROM guided_learning_commands WHERE idempotency_key = ?",
        )
        .get("idem-atomic-retry"),
    ).toEqual({ count: 0 });
    expect(
      rt.database
        .prepare(
          "SELECT superseded_at FROM guided_learning_failures WHERE session_id = ?",
        )
        .get(session.session_id),
    ).toEqual({ superseded_at: null });
    rt.database.close();
  });

  it("scopes Evidence IDs to a Session and preserves other Session projections", () => {
    const rt = makeRuntime();
    const first = prepareAnsweredSession(rt, "question_first");
    rt.guidedLearningRuntime.writeFeedback({
      session_id: first.sessionId,
      ...makeFeedback("docv_test"),
    });
    const firstSession = rt.guidedLearningRuntime.getSession(first.sessionId);
    expect(() =>
      first.command(
        "CONFIRM_QUESTION",
        {
          question_id: first.question?.question_id,
          question_order: first.question?.order,
        },
        `${first.sessionId}-confirm`,
      ),
    ).not.toThrow();
    first.command(
      "ADVANCE_QUESTION",
      {
        question_id: first.question?.question_id,
        question_order: first.question?.order,
      },
      `${first.sessionId}-advance`,
    );
    const nextQuestion = rt.guidedLearningRuntime.getSession(first.sessionId)
      .questions?.[1];
    first.command(
      "SUBMIT_ANSWER",
      {
        question_id: nextQuestion?.question_id,
        question_order: nextQuestion?.order,
        answer: "第二个回答",
      },
      `${first.sessionId}-answer-2`,
    );
    expect(() =>
      rt.guidedLearningRuntime.writeFeedback({
        session_id: first.sessionId,
        ...makeFeedback("docv_test"),
      }),
    ).toThrowError(/DUPLICATE_EVIDENCE_ID/);

    const second = prepareAnsweredSession(rt, "question_second");
    rt.guidedLearningRuntime.writeFeedback({
      session_id: second.sessionId,
      ...makeFeedback("docv_test"),
    });
    const rows = rt.database
      .prepare(
        "SELECT session_id, evidence_id, question_id FROM guided_learning_evidence ORDER BY session_id",
      )
      .all();
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          session_id: firstSession.session_id,
          evidence_id: "evidence_test_1",
          question_id: first.question?.question_id,
        },
        {
          session_id: second.sessionId,
          evidence_id: "evidence_test_1",
          question_id: second.question?.question_id,
        },
      ]),
    );
    expect(() =>
      rt.database
        .prepare(
          "INSERT INTO guided_learning_evidence(session_id, evidence_id, question_id, evidence_json) VALUES (?, ?, ?, ?)",
        )
        .run(
          second.sessionId,
          "evidence_cross_session_question",
          first.question?.question_id ?? "question_missing",
          "{}",
        ),
    ).toThrow();
    rt.database.close();
  });

  it("rejects non-verified or mismatched Evidence and permits a citation-free insufficient claim", () => {
    for (const status of [
      "PENDING",
      "INVALID",
      "INSUFFICIENT_EVIDENCE",
    ] as const) {
      const rt = makeRuntime();
      const prepared = prepareAnsweredSession(rt);
      expect(() =>
        rt.guidedLearningRuntime.writeFeedback({
          session_id: prepared.sessionId,
          ...makeFeedback("docv_test", status),
        }),
      ).toThrowError(/EVIDENCE_NOT_VERIFIED/);
      rt.database.close();
    }

    const mismatchRuntime = makeRuntime();
    const mismatch = prepareAnsweredSession(mismatchRuntime);
    expect(() =>
      mismatchRuntime.guidedLearningRuntime.writeFeedback({
        session_id: mismatch.sessionId,
        ...makeFeedback("docv_other"),
      }),
    ).toThrowError(/EVIDENCE_DOCUMENT_MISMATCH/);
    mismatchRuntime.database.close();

    const insufficientRuntime = makeRuntime();
    const insufficient = prepareAnsweredSession(insufficientRuntime);
    const noCitation = makeFeedback("docv_test") as {
      feedback: Record<string, unknown>;
      reference_answer: { claims: Array<Record<string, unknown>> };
      evidence: Record<string, unknown>[];
    };
    noCitation.reference_answer.claims[0] = {
      text: "证据不足，无法支持该主张。",
      claim_type: "INSUFFICIENT_EVIDENCE",
      evidence_refs: [],
    };
    insufficientRuntime.guidedLearningRuntime.writeFeedback({
      session_id: insufficient.sessionId,
      ...noCitation,
    });
    expect(
      insufficient.command(
        "CONFIRM_QUESTION",
        {
          question_id: insufficient.question?.question_id,
          question_order: insufficient.question?.order,
        },
        "insufficient-confirm",
      ).session.state,
    ).toBe("QUESTION_COMPLETED");
    insufficientRuntime.database.close();
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
    const createdData = (
      created.json() as {
        data: {
          session: { session_id: string; state: string };
          job_id: string;
        };
      }
    ).data;
    expect(createdData.session.state).toBe("CREATED");
    expect(createdData.job_id).toMatch(/^job_/);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/guided-learning/sessions/${createdData.session.session_id}`,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/guided-learning/sessions/${createdData.session.session_id}/commands`,
          payload: {
            contract_version: "guided-learning.v1",
            event: "SELECT_DIRECTION",
            payload: {
              direction_id: "direction_method",
            },
            idempotency_key: "api-idem",
          },
        })
      ).statusCode,
    ).toBe(409);
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
