import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { AnySchema } from "ajv";
import { describe, expect, it } from "vitest";
import {
  GUIDED_LEARNING_STATES,
  GUIDED_LEARNING_TRANSITIONS,
  applyGuidedLearningEvent,
  isCanonicalGuidedLearningRoute,
  validateGuidedLearningSessionConsistency,
} from "../../packages/contracts/wave1/src/index.js";
import type {
  GuidedLearningFailure,
  GuidedLearningRoute,
} from "../../packages/contracts/wave1/src/index.js";

const schemaDirectory = resolve("packages/contracts/wave1");
const fixtureDirectory = resolve("tests/fixtures/contracts/guided-learning");
const Ajv2020 = Ajv2020Module.default;
const addFormats = addFormatsModule.default;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readSchema(path: string): AnySchema {
  return readJson(path) as AnySchema;
}

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(
    readSchema(resolve(schemaDirectory, "evidence.v1.schema.json")),
    "evidence.v1.schema.json",
  );
  ajv.addSchema(
    readSchema(resolve(schemaDirectory, "guided-learning.v1.schema.json")),
    "guided-learning.v1.schema.json",
  );
  const check = ajv.getSchema("guided-learning.v1.schema.json");
  if (!check) throw new Error("guided-learning schema was not registered");
  return check;
}

function readSessionFixture(name: string): Record<string, unknown> {
  return readJson(resolve(fixtureDirectory, name)) as Record<string, unknown>;
}

const sessionFixtureNames = [
  "created.json",
  "directions-pending.json",
  "route-locked.json",
  "questions-generating.json",
  "answer-submitted.json",
  "feedback-ready.json",
  "question-feedback-confirmed.json",
  "question-skip.json",
  "summary-generating.json",
  "stage-summary.json",
  "session-completed.json",
  "retryable-failure.json",
  "failed.json",
] as const;

const commandContext = {
  idempotencyKey: "idem_test_1",
  sessionId: "learning_fixture_1",
  requestFingerprint: "sha256:submit-answer-a",
};

function failure(
  operation: GuidedLearningFailure["failed_operation"],
  resumeState: GuidedLearningFailure["resume_state"],
  failureClass: GuidedLearningFailure["failure_class"] = "RETRYABLE",
): GuidedLearningFailure {
  return {
    failure_id: "failure_test_1",
    failure_class: failureClass,
    failed_operation: operation,
    resume_state: resumeState,
    error_code: "TEMPORARY_UNAVAILABLE",
    message: "生成服务暂时不可用。",
    attempt: 1,
  } as GuidedLearningFailure;
}

function consistencyOf(name: string) {
  const fixture = readSessionFixture(name);
  return validateGuidedLearningSessionConsistency(
    (fixture.session ?? fixture) as never,
  );
}

describe("guided-learning.v1 contract", () => {
  it("validates every stable-state fixture and its cross-field consistency", () => {
    const check = createValidator();
    for (const name of sessionFixtureNames) {
      const value = readSessionFixture(name);
      expect(check(value), `${name}: ${JSON.stringify(check.errors)}`).toBe(
        true,
      );
      expect(consistencyOf(name), name).toMatchObject({
        valid: true,
        errors: [],
      });
      expect(JSON.stringify(value)).not.toMatch(
        /api[_-]?key|internal[_-]?path|sourcePath|absolute_path|full_document_text/i,
      );
    }
  });

  it("rejects server-only fields, route bypasses and illegal question shapes", () => {
    const check = createValidator();
    for (const name of [
      "invalid-server-fields.json",
      "invalid-route-bypass.json",
    ]) {
      expect(check(readJson(resolve(fixtureDirectory, name)))).toBe(false);
    }

    const valid = readSessionFixture("question-feedback-confirmed.json");
    const session = valid.session as Record<string, unknown>;
    const questions = session.questions as Array<Record<string, unknown>>;
    const feedbackBeforeAnswer = structuredClone(valid) as Record<
      string,
      unknown
    >;
    const feedbackQuestions = (
      feedbackBeforeAnswer.session as Record<string, unknown>
    ).questions as Array<Record<string, unknown>>;
    feedbackQuestions[1] = {
      ...feedbackQuestions[1],
      status: "FEEDBACK_READY",
      feedback: { summary: "premature", omissions: [] },
      reference_answer: {
        text: "premature",
        claims: [
          {
            text: "premature",
            claim_type: "PAPER_FACT",
            evidence_refs: ["evidence_fixture_1"],
          },
        ],
      },
      evidence: [
        {
          evidence_span_id: "evidence_fixture_1",
          document_version_id: "docv_fixture_1",
          page_number: 1,
          page_text_sha256: "a".repeat(64),
          extraction_profile_version: "pdfjs-text-v1",
          char_start: 0,
          char_end: 12,
          quote: "Method text.",
          verification_status: "VERIFIED",
        },
      ],
    };
    expect(check(feedbackBeforeAnswer)).toBe(false);

    const answerAndSkip = structuredClone(valid) as Record<string, unknown>;
    const answerQuestions = (answerAndSkip.session as Record<string, unknown>)
      .questions as Array<Record<string, unknown>>;
    answerQuestions[1] = {
      ...answerQuestions[1],
      status: "SKIPPED",
      confirmation_status: "SKIPPED",
      skip_reason: "I_DONT_KNOW",
      user_answer: "同时回答不允许",
    };
    expect(check(answerAndSkip)).toBe(false);
    expect(questions.length).toBe(3);
  });

  it("keeps the existing quick-question fixtures valid", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    ajv.addSchema(
      readSchema(resolve(schemaDirectory, "api.v1.schema.json")),
      "api.v1.schema.json",
    );
    ajv.addSchema(
      readSchema(resolve(schemaDirectory, "error.v1.schema.json")),
      "error.v1.schema.json",
    );
    const check = ajv.getSchema("api.v1.schema.json");
    expect(
      check?.(readJson(resolve("tests/fixtures/contracts/api-success.json"))),
    ).toBe(true);
    expect(
      check?.(readJson(resolve("tests/fixtures/contracts/api-failure.json"))),
    ).toBe(true);
  });

  it("has a reachable state graph with explicit generation and completion states", () => {
    const terminalStates = new Set(["FAILED", "SESSION_COMPLETED"]);
    const reachable = new Set(["CREATED"]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const transition of GUIDED_LEARNING_TRANSITIONS) {
        if (reachable.has(transition.from) && !reachable.has(transition.to)) {
          reachable.add(transition.to);
          changed = true;
        }
      }
    }
    expect(new Set(GUIDED_LEARNING_STATES)).toEqual(reachable);
    for (const state of GUIDED_LEARNING_STATES) {
      expect(
        state === "RETRYABLE_FAILURE" || terminalStates.has(state)
          ? GUIDED_LEARNING_TRANSITIONS.some(
              (transition) => transition.from === state,
            ) ||
              state === "FAILED" ||
              state === "SESSION_COMPLETED"
          : GUIDED_LEARNING_TRANSITIONS.some(
              (transition) => transition.from === state,
            ),
      ).toBe(true);
    }
    expect(
      GUIDED_LEARNING_TRANSITIONS.every((transition) =>
        GUIDED_LEARNING_STATES.includes(transition.to),
      ),
    ).toBe(true);
    expect(
      GUIDED_LEARNING_TRANSITIONS.filter(
        (transition) => transition.from === "FAILED",
      ),
    ).toHaveLength(0);
    expect(
      GUIDED_LEARNING_TRANSITIONS.filter(
        (transition) => transition.from === "SESSION_COMPLETED",
      ),
    ).toHaveLength(0);
  });

  it("enforces the ordered guided transitions and generation states", () => {
    expect(
      applyGuidedLearningEvent({ state: "CREATED", event: "DIRECTIONS_READY" }),
    ).toMatchObject({
      outcome: "APPLIED",
      to_state: "AWAITING_DIRECTION_SELECTION",
      actor: "SERVER",
    });
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_DIRECTION_SELECTION",
        event: "SELECT_DIRECTION",
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "ROUTE_LOCKED" });
    expect(
      applyGuidedLearningEvent({
        state: "ROUTE_LOCKED",
        event: "START_STAGE",
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "QUESTIONS_GENERATING" });
    expect(
      applyGuidedLearningEvent({
        state: "QUESTIONS_GENERATING",
        event: "QUESTIONS_READY",
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "AWAITING_ANSWER" });
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_ANSWER",
        event: "SUBMIT_ANSWER",
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "ANSWER_SUBMITTED" });
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_ANSWER",
        event: "SKIP_QUESTION",
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "QUESTION_COMPLETED" });
    expect(
      applyGuidedLearningEvent({
        state: "ANSWER_SUBMITTED",
        event: "SKIP_QUESTION",
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "REJECTED", reason: "ILLEGAL_TRANSITION" });
    expect(
      applyGuidedLearningEvent({
        state: "QUESTION_COMPLETED",
        event: "ADVANCE_QUESTION",
        ...commandContext,
      }),
    ).toMatchObject({
      outcome: "REJECTED",
      reason: "REMAINING_QUESTION_CONTEXT_REQUIRED",
    });
    expect(
      applyGuidedLearningEvent({
        state: "QUESTION_COMPLETED",
        event: "ADVANCE_QUESTION",
        hasRemainingQuestions: true,
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "AWAITING_ANSWER" });
    expect(
      applyGuidedLearningEvent({
        state: "QUESTION_COMPLETED",
        event: "ADVANCE_QUESTION",
        hasRemainingQuestions: false,
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "SUMMARY_GENERATING" });
    expect(
      applyGuidedLearningEvent({
        state: "SUMMARY_GENERATING",
        event: "SUMMARY_READY",
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "STAGE_COMPLETED" });
    expect(
      applyGuidedLearningEvent({
        state: "STAGE_COMPLETED",
        event: "COMPLETE_SESSION",
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "SESSION_COMPLETED" });
  });

  it("requires a server failure context and resumes the recorded state", () => {
    const cases = [
      ["CREATED", failure("GENERATE_DIRECTIONS", "CREATED")],
      ["ROUTE_LOCKED", failure("GENERATE_QUESTIONS", "ROUTE_LOCKED")],
      [
        "QUESTIONS_GENERATING",
        failure("GENERATE_QUESTIONS", "QUESTIONS_GENERATING"),
      ],
      ["ANSWER_SUBMITTED", failure("GENERATE_FEEDBACK", "ANSWER_SUBMITTED")],
      [
        "QUESTION_COMPLETED",
        failure("GENERATE_STAGE_SUMMARY", "QUESTION_COMPLETED"),
      ],
      [
        "SUMMARY_GENERATING",
        failure("GENERATE_STAGE_SUMMARY", "SUMMARY_GENERATING"),
      ],
    ] as const;
    for (const [state, context] of cases) {
      const failed = applyGuidedLearningEvent({
        state,
        event: "RETRYABLE_FAILURE",
        failureContext: context,
      });
      expect(failed).toMatchObject({
        outcome: "APPLIED",
        to_state: "RETRYABLE_FAILURE",
      });
      expect(
        applyGuidedLearningEvent({
          state: "RETRYABLE_FAILURE",
          event: "RETRY",
          failureContext: context,
          resumeShapeValidated: true,
          ...commandContext,
        }),
      ).toMatchObject({ outcome: "APPLIED", to_state: context.resume_state });
    }
    expect(
      applyGuidedLearningEvent({
        state: "ROUTE_LOCKED",
        event: "RETRYABLE_FAILURE",
        failureContext: failure("GENERATE_FEEDBACK", "ANSWER_SUBMITTED"),
      }),
    ).toMatchObject({
      outcome: "REJECTED",
      reason: "INVALID_FAILURE_RESUME_STATE",
    });
    expect(
      applyGuidedLearningEvent({
        state: "FAILED",
        event: "RETRY",
        failureContext: failure("GENERATE_DIRECTIONS", "CREATED", "PERMANENT"),
        resumeShapeValidated: true,
        ...commandContext,
      }),
    ).toMatchObject({ outcome: "REJECTED", reason: "ILLEGAL_TRANSITION" });
  });

  it("requires verified, document-local Evidence before feedback can be confirmed", () => {
    const source = readSessionFixture("feedback-ready.json");
    const sourceSession = source.session as Record<string, unknown>;
    const sourceQuestions = sourceSession.questions as Array<
      Record<string, unknown>
    >;

    const mutate = (
      fn: (
        session: Record<string, unknown>,
        currentQuestion: Record<string, unknown>,
      ) => void,
      session = source,
    ) => {
      const copy = structuredClone(session) as Record<string, unknown>;
      const value = copy.session as Record<string, unknown>;
      const questions = value.questions as Array<Record<string, unknown>>;
      fn(value, questions[1]);
      return validateGuidedLearningSessionConsistency(value as never);
    };

    expect(
      validateGuidedLearningSessionConsistency(sourceSession as never),
    ).toMatchObject({ valid: true, errors: [] });
    for (const status of ["PENDING", "INVALID"] as const) {
      const result = mutate((_session, question) => {
        const evidence = question.evidence as Array<Record<string, unknown>>;
        evidence[0].verification_status = status;
      });
      expect(result.valid).toBe(false);
      expect(result.errors.map((error) => error.code)).toContain(
        "EVIDENCE_NOT_VERIFIED",
      );
    }
    expect(
      mutate((_session, question) => {
        const referenceAnswer = question.reference_answer as Record<
          string,
          unknown
        >;
        const claims = referenceAnswer.claims as Array<Record<string, unknown>>;
        claims[0].evidence_refs = ["evidence_missing"];
      }),
    ).toMatchObject({ valid: false });
    expect(
      mutate((_session, question) => {
        const evidence = question.evidence as Array<Record<string, unknown>>;
        evidence.push({ ...evidence[0] });
      }),
    ).toMatchObject({ valid: false });
    const duplicateAcrossQuestions = mutate((session, question) => {
      const questions = session.questions as Array<Record<string, unknown>>;
      const firstEvidence = (
        questions[0].evidence as Array<Record<string, unknown>>
      )[0];
      const currentEvidence = question.evidence as Array<
        Record<string, unknown>
      >;
      currentEvidence[0].evidence_span_id = firstEvidence.evidence_span_id;
    });
    expect(
      duplicateAcrossQuestions.errors.map((error) => error.code),
    ).toContain("DUPLICATE_EVIDENCE_ID");
    expect(
      mutate((_session, question) => {
        const evidence = question.evidence as Array<Record<string, unknown>>;
        evidence[0].document_version_id = "docv_other";
      }),
    ).toMatchObject({ valid: false });
    const missingEvidence = mutate((_session, question) => {
      const referenceAnswer = question.reference_answer as Record<
        string,
        unknown
      >;
      const claims = referenceAnswer.claims as Array<Record<string, unknown>>;
      claims[0].evidence_refs = ["evidence_missing"];
    });
    expect(missingEvidence.errors.map((error) => error.code)).toContain(
      "EVIDENCE_REFERENCE_NOT_FOUND",
    );
    expect(
      mutate((_session, question) => {
        const evidence = question.evidence as Array<Record<string, unknown>>;
        evidence[0].verification_status = "PENDING";
      }),
    ).toMatchObject({ valid: false });
    expect(
      mutate((_session, question) => {
        const referenceAnswer = question.reference_answer as Record<
          string,
          unknown
        >;
        const claims = referenceAnswer.claims as Array<Record<string, unknown>>;
        claims[0].claim_type = "INSUFFICIENT_EVIDENCE";
        claims[0].evidence_refs = ["evidence_feedback_2"];
      }),
    ).toMatchObject({ valid: false });
    expect(
      mutate((_session, question) => {
        const referenceAnswer = question.reference_answer as Record<
          string,
          unknown
        >;
        const claims = referenceAnswer.claims as Array<Record<string, unknown>>;
        claims[0].evidence_refs = [
          "evidence_feedback_2",
          "evidence_feedback_2",
        ];
      }),
    ).toMatchObject({ valid: false });

    const confirmed = structuredClone(source) as Record<string, unknown>;
    const confirmedSession = confirmed.session as Record<string, unknown>;
    confirmedSession.state = "QUESTION_COMPLETED";
    const confirmedQuestions = confirmedSession.questions as Array<
      Record<string, unknown>
    >;
    confirmedQuestions[1].status = "CONFIRMED";
    confirmedQuestions[1].confirmation_status = "CONFIRMED";
    expect(
      validateGuidedLearningSessionConsistency(confirmedSession as never),
    ).toMatchObject({ valid: true, errors: [] });
    confirmedQuestions[1].evidence = [
      {
        ...(
          confirmedQuestions[1].evidence as Array<Record<string, unknown>>
        )[0],
        verification_status: "INVALID",
      },
    ];
    expect(
      validateGuidedLearningSessionConsistency(confirmedSession as never),
    ).toMatchObject({ valid: false });
    expect(sourceQuestions.length).toBe(3);
  });

  it("requires server Evidence readiness context for CONFIRM_QUESTION", () => {
    const base = {
      state: "FEEDBACK_READY" as const,
      event: "CONFIRM_QUESTION" as const,
      ...commandContext,
    };
    expect(applyGuidedLearningEvent(base)).toMatchObject({
      outcome: "REJECTED",
      reason: "EVIDENCE_CONFIRMATION_CONTEXT_REQUIRED",
    });
    expect(
      applyGuidedLearningEvent({ ...base, evidenceReady: false }),
    ).toMatchObject({ outcome: "REJECTED", reason: "EVIDENCE_NOT_READY" });
    expect(
      applyGuidedLearningEvent({ ...base, canConfirmCurrentQuestion: true }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "QUESTION_COMPLETED" });
  });

  it("validates every failure resume shape and requires validated retry context", () => {
    const makeFailureSession = (
      fixtureName: string,
      context: GuidedLearningFailure,
    ) => {
      const fixture = readSessionFixture(fixtureName);
      const session = structuredClone(fixture.session) as Record<
        string,
        unknown
      >;
      session.state =
        context.failure_class === "PERMANENT" ? "FAILED" : "RETRYABLE_FAILURE";
      session.failure = context;
      return session;
    };
    const expectCode = (session: Record<string, unknown>, code: string) => {
      const result = validateGuidedLearningSessionConsistency(session as never);
      expect(result.valid).toBe(false);
      expect(result.errors.map((error) => error.code)).toContain(code);
    };

    const validCases: Array<[string, GuidedLearningFailure]> = [
      ["created.json", failure("GENERATE_DIRECTIONS", "CREATED")],
      ["route-locked.json", failure("GENERATE_QUESTIONS", "ROUTE_LOCKED")],
      [
        "questions-generating.json",
        failure("GENERATE_QUESTIONS", "QUESTIONS_GENERATING"),
      ],
      [
        "answer-submitted.json",
        failure("GENERATE_FEEDBACK", "ANSWER_SUBMITTED"),
      ],
      [
        "summary-generating.json",
        failure("GENERATE_STAGE_SUMMARY", "SUMMARY_GENERATING"),
      ],
    ];
    for (const [fixtureName, context] of validCases)
      expect(
        validateGuidedLearningSessionConsistency(
          makeFailureSession(fixtureName, context) as never,
        ),
        `${fixtureName}:${context.resume_state}`,
      ).toMatchObject({ valid: true, errors: [] });

    const completedFailure = makeFailureSession(
      "question-skip.json",
      failure("GENERATE_STAGE_SUMMARY", "QUESTION_COMPLETED"),
    );
    const completedQuestions = completedFailure.questions as Array<
      Record<string, unknown>
    >;
    completedQuestions[1].status = "SKIPPED";
    completedQuestions[1].confirmation_status = "SKIPPED";
    completedQuestions[1].skip_reason = "I_DONT_KNOW";
    expect(
      validateGuidedLearningSessionConsistency(completedFailure as never),
    ).toMatchObject({ valid: true, errors: [] });

    const createdWithDirections = makeFailureSession(
      "route-locked.json",
      failure("GENERATE_DIRECTIONS", "CREATED"),
    );
    expectCode(createdWithDirections, "FAILURE_RESUME_SHAPE_INVALID");
    expectCode(createdWithDirections, "RESUME_STATE_FORBIDDEN_FIELD_PRESENT");

    const routeMissingStage = makeFailureSession(
      "route-locked.json",
      failure("GENERATE_QUESTIONS", "ROUTE_LOCKED"),
    );
    delete routeMissingStage.current_stage_id;
    expectCode(routeMissingStage, "RESUME_STATE_REQUIRED_FIELD_MISSING");

    const routeWithQuestions = makeFailureSession(
      "route-locked.json",
      failure("GENERATE_QUESTIONS", "ROUTE_LOCKED"),
    );
    routeWithQuestions.questions = [];
    expectCode(routeWithQuestions, "RESUME_STATE_FORBIDDEN_FIELD_PRESENT");

    const generatingWithQuestions = makeFailureSession(
      "questions-generating.json",
      failure("GENERATE_QUESTIONS", "QUESTIONS_GENERATING"),
    );
    generatingWithQuestions.questions = [];
    expectCode(generatingWithQuestions, "RESUME_STATE_FORBIDDEN_FIELD_PRESENT");

    const answerNotSubmitted = makeFailureSession(
      "answer-submitted.json",
      failure("GENERATE_FEEDBACK", "ANSWER_SUBMITTED"),
    );
    const answerQuestions = answerNotSubmitted.questions as Array<
      Record<string, unknown>
    >;
    answerQuestions[1].status = "ACTIVE";
    answerQuestions[1].confirmation_status = "PENDING";
    delete answerQuestions[1].user_answer;
    expectCode(answerNotSubmitted, "RESUME_STATE_REQUIRED_FIELD_MISSING");

    const completedUnresolved = makeFailureSession(
      "question-skip.json",
      failure("GENERATE_STAGE_SUMMARY", "QUESTION_COMPLETED"),
    );
    completedUnresolved.state = "RETRYABLE_FAILURE";
    expectCode(completedUnresolved, "RESUME_STATE_REQUIRED_FIELD_MISSING");

    const summaryUnresolved = makeFailureSession(
      "summary-generating.json",
      failure("GENERATE_STAGE_SUMMARY", "SUMMARY_GENERATING"),
    );
    const summaryQuestions = summaryUnresolved.questions as Array<
      Record<string, unknown>
    >;
    summaryQuestions[1].status = "ACTIVE";
    summaryQuestions[1].confirmation_status = "PENDING";
    expectCode(summaryUnresolved, "COMPLETION_REQUIRES_RESOLVED_QUESTIONS");

    const summaryWithResult = makeFailureSession(
      "summary-generating.json",
      failure("GENERATE_STAGE_SUMMARY", "SUMMARY_GENERATING"),
    );
    summaryWithResult.stage_summary = {
      stage_id: "UNDERSTAND",
      status: "GENERATED",
      completed_question_orders: [],
      skipped_question_orders: [1, 2, 3],
      key_mastery_points: ["x"],
      major_weak_points: ["y"],
      next_stage_hint: "z",
    };
    expectCode(summaryWithResult, "RESUME_STATE_FORBIDDEN_FIELD_PRESENT");

    expect(
      applyGuidedLearningEvent({
        state: "RETRYABLE_FAILURE",
        event: "RETRY",
        failureContext: failure("GENERATE_QUESTIONS", "ROUTE_LOCKED"),
        ...commandContext,
      }),
    ).toMatchObject({
      outcome: "REJECTED",
      reason: "FAILURE_RESUME_SHAPE_REQUIRED",
    });
  });

  it("keeps summary completion and route stage status aligned", () => {
    const summary = readSessionFixture("summary-generating.json");
    const summarySession = summary.session as Record<string, unknown>;
    const summaryQuestions = summarySession.questions as Array<
      Record<string, unknown>
    >;
    summaryQuestions[1].status = "ACTIVE";
    summaryQuestions[1].confirmation_status = "PENDING";
    expect(
      validateGuidedLearningSessionConsistency(summarySession as never),
    ).toMatchObject({ valid: false });
    expect(
      validateGuidedLearningSessionConsistency(
        summarySession as never,
      ).errors.map((error) => error.code),
    ).toContain("COMPLETION_REQUIRES_RESOLVED_QUESTIONS");

    for (const fixtureName of [
      "stage-summary.json",
      "session-completed.json",
    ] as const) {
      const fixture = readSessionFixture(fixtureName);
      const session = fixture.session as Record<string, unknown>;
      const route = session.route as Record<string, unknown>;
      const stages = route.stages as Array<Record<string, unknown>>;
      stages[0].status = "OPEN";
      const result = validateGuidedLearningSessionConsistency(session as never);
      expect(result.errors.map((error) => error.code)).toContain(
        "ROUTE_STAGE_STATUS_MISMATCH",
      );
    }
    const processing = readSessionFixture("question-feedback-confirmed.json");
    const processingSession = processing.session as Record<string, unknown>;
    const processingRoute = processingSession.route as Record<string, unknown>;
    const processingStages = processingRoute.stages as Array<
      Record<string, unknown>
    >;
    processingStages[0].status = "COMPLETED";
    expect(
      validateGuidedLearningSessionConsistency(
        processingSession as never,
      ).errors.map((error) => error.code),
    ).toContain("ROUTE_STAGE_STATUS_MISMATCH");
  });

  it("binds idempotency to session, event and request fingerprint", () => {
    const record = {
      idempotency_key: "idem_answer_1",
      session_id: "learning_1",
      event: "SUBMIT_ANSWER" as const,
      request_fingerprint: "sha256:answer-a",
      from_state: "AWAITING_ANSWER" as const,
      to_state: "ANSWER_SUBMITTED" as const,
      actor: "CLIENT" as const,
      result_revision: 3,
    };
    expect(
      applyGuidedLearningEvent({
        state: "ANSWER_SUBMITTED",
        event: "SUBMIT_ANSWER",
        idempotencyKey: "idem_answer_1",
        sessionId: "learning_1",
        requestFingerprint: "sha256:answer-a",
        idempotencyRecords: [record],
      }),
    ).toMatchObject({
      outcome: "IDEMPOTENT",
      to_state: "ANSWER_SUBMITTED",
      result_revision: 3,
    });
    for (const conflict of [
      {
        sessionId: "learning_2",
        requestFingerprint: "sha256:answer-a",
        event: "SUBMIT_ANSWER" as const,
      },
      {
        sessionId: "learning_1",
        requestFingerprint: "sha256:answer-b",
        event: "SUBMIT_ANSWER" as const,
      },
      {
        sessionId: "learning_1",
        requestFingerprint: "sha256:answer-a",
        event: "SKIP_QUESTION" as const,
      },
    ]) {
      expect(
        applyGuidedLearningEvent({
          state: "ANSWER_SUBMITTED",
          idempotencyKey: "idem_answer_1",
          idempotencyRecords: [record],
          ...conflict,
        }),
      ).toMatchObject({
        outcome: "REJECTED",
        reason: "IDEMPOTENCY_KEY_REUSED",
      });
    }
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_ANSWER",
        event: "SUBMIT_ANSWER",
        sessionId: "learning_1",
        requestFingerprint: "sha256:answer-a",
      }),
    ).toMatchObject({
      outcome: "REJECTED",
      reason: "IDEMPOTENCY_KEY_REQUIRED",
    });
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_ANSWER",
        event: "SUBMIT_ANSWER",
        idempotencyKey: "idem_missing_context",
      }),
    ).toMatchObject({
      outcome: "REJECTED",
      reason: "IDEMPOTENCY_CONTEXT_REQUIRED",
    });
  });

  it("reports stable cross-field consistency errors", () => {
    const source = readSessionFixture("question-feedback-confirmed.json");
    const mutate = (fn: (session: Record<string, unknown>) => void) => {
      const copy = structuredClone(source) as Record<string, unknown>;
      const session = copy.session as Record<string, unknown>;
      fn(session);
      return validateGuidedLearningSessionConsistency(session as never);
    };
    const expectCode = (
      result: ReturnType<typeof validateGuidedLearningSessionConsistency>,
      code: string,
    ) => {
      expect(result.valid).toBe(false);
      expect(result.errors.map((error) => error.code)).toContain(code);
    };
    expectCode(
      mutate((session) => {
        session.selected_direction_id = "direction_missing";
      }),
      "SELECTED_DIRECTION_NOT_FOUND",
    );
    expectCode(
      mutate((session) => {
        const directions = session.candidate_directions as Array<
          Record<string, unknown>
        >;
        directions.push({ ...directions[0] });
      }),
      "DUPLICATE_DIRECTION_ID",
    );
    expectCode(
      mutate((session) => {
        const questions = session.questions as Array<Record<string, unknown>>;
        questions[1].question_id = questions[0].question_id;
      }),
      "DUPLICATE_QUESTION_ID",
    );
    expectCode(
      mutate((session) => {
        const questions = session.questions as Array<Record<string, unknown>>;
        questions[1].order = questions[0].order;
      }),
      "DUPLICATE_QUESTION_ORDER",
    );
    expectCode(
      mutate((session) => {
        const questions = session.questions as Array<Record<string, unknown>>;
        questions[1].order = 4;
      }),
      "QUESTION_ORDER_NOT_CONTIGUOUS",
    );
    expectCode(
      mutate((session) => {
        const questions = session.questions as Array<Record<string, unknown>>;
        questions.reverse();
      }),
      "QUESTION_ARRAY_ORDER_MISMATCH",
    );
    expectCode(
      mutate((session) => {
        session.current_question_order = 99;
      }),
      "CURRENT_QUESTION_NOT_FOUND",
    );
    expectCode(
      mutate((session) => {
        const questions = session.questions as Array<Record<string, unknown>>;
        questions[2].status = "ACTIVE";
        questions[2].confirmation_status = "PENDING";
      }),
      "MULTIPLE_ACTIVE_QUESTIONS",
    );
    expectCode(
      mutate((session) => {
        const questions = session.questions as Array<Record<string, unknown>>;
        questions[1].status = "UNSEEN";
      }),
      "AWAITING_ANSWER_REQUIRES_ACTIVE_QUESTION",
    );
    expectCode(
      mutate((session) => {
        session.current_question_order = 1;
      }),
      "CURRENT_QUESTION_POINTER_MISMATCH",
    );
    expectCode(
      mutate((session) => {
        const summary = {
          stage_id: "UNDERSTAND",
          status: "GENERATED",
          completed_question_orders: [1],
          skipped_question_orders: [1],
          key_mastery_points: ["x"],
          major_weak_points: ["y"],
          next_stage_hint: "z",
        };
        session.stage_summary = summary;
        session.state = "SESSION_COMPLETED";
      }),
      "SUMMARY_ORDERS_OVERLAP",
    );
    const invalidSummary = readSessionFixture("stage-summary.json");
    const invalidSummarySession = invalidSummary.session as Record<
      string,
      unknown
    >;
    (
      invalidSummarySession.stage_summary as Record<string, unknown>
    ).skipped_question_orders = [99];
    expectCode(
      validateGuidedLearningSessionConsistency(invalidSummarySession as never),
      "SUMMARY_ORDERS_INVALID",
    );
    expectCode(
      mutate((session) => {
        session.state = "SESSION_COMPLETED";
        delete session.stage_summary;
      }),
      "SUMMARY_REQUIRED",
    );
    expectCode(
      mutate((session) => {
        session.state = "SESSION_COMPLETED";
        (session.questions as Array<Record<string, unknown>>).length = 0;
      }),
      "COMPLETION_REQUIRES_QUESTIONS",
    );
    expectCode(
      mutate((session) => {
        session.route = {
          ...(session.route as Record<string, unknown>),
          stages: [
            {
              stage_id: "UNDERSTAND",
              order: 1,
              title: "理解",
              status: "OPEN",
              unlock_condition: "SESSION_DIRECTION_SELECTED",
            },
            {
              stage_id: "ANALYZE",
              order: 2,
              title: "分析",
              status: "OPEN",
              unlock_condition: "PREVIOUS_STAGE_COMPLETED",
            },
            {
              stage_id: "TRANSFER",
              order: 3,
              title: "迁移",
              status: "LOCKED",
              unlock_condition: "NOT_AVAILABLE_IN_V1",
            },
          ],
        };
      }),
      "NON_CANONICAL_ROUTE",
    );
    expectCode(
      mutate((session) => {
        session.failure = failure("GENERATE_FEEDBACK", "ANSWER_SUBMITTED");
      }),
      "FAILURE_NOT_ALLOWED",
    );
    expectCode(
      mutate((session) => {
        session.state = "RETRYABLE_FAILURE";
        session.failure = failure("GENERATE_FEEDBACK", "CREATED");
      }),
      "FAILURE_RESUME_MISMATCH",
    );
  });

  it("keeps the fixed route server-owned and later stages locked", () => {
    const fixture = readSessionFixture("route-locked.json") as {
      session: { route: GuidedLearningRoute };
    };
    expect(isCanonicalGuidedLearningRoute(fixture.session.route)).toBe(true);
  });
});
