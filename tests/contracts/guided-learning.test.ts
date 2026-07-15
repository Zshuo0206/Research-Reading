import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import type { AnySchema } from "ajv";
import { describe, expect, it } from "vitest";
import {
  applyGuidedLearningEvent,
  isCanonicalGuidedLearningRoute,
} from "../../packages/contracts/wave1/src/index.js";
import type { GuidedLearningRoute } from "../../packages/contracts/wave1/src/index.js";

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

describe("guided-learning.v1 contract", () => {
  it("validates the complete positive fixture set", () => {
    const check = createValidator();
    for (const name of [
      "directions-pending.json",
      "route-locked.json",
      "question-feedback-confirmed.json",
      "question-skip.json",
      "stage-summary.json",
      "session-completed.json",
      "command-submit-answer.json",
      "command-submit-answer-duplicate.json",
    ]) {
      const value = readJson(resolve(fixtureDirectory, name));
      expect(check(value), `${name}: ${JSON.stringify(check.errors)}`).toBe(
        true,
      );
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

    const valid = readJson(
      resolve(fixtureDirectory, "question-feedback-confirmed.json"),
    ) as {
      session: { questions: Array<Record<string, unknown>> };
    };
    const feedbackBeforeAnswer = structuredClone(valid);
    feedbackBeforeAnswer.session.questions[1] = {
      ...feedbackBeforeAnswer.session.questions[1],
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

    const answerAndSkip = structuredClone(valid);
    answerAndSkip.session.questions[1] = {
      ...answerAndSkip.session.questions[1],
      status: "SKIPPED",
      confirmation_status: "SKIPPED",
      skip_reason: "I_DONT_KNOW",
      user_answer: "同时回答不允许",
    };
    expect(check(answerAndSkip)).toBe(false);
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

  it("enforces server/client state ownership and ordered guided transitions", () => {
    expect(
      applyGuidedLearningEvent({
        state: "CREATED",
        event: "DIRECTIONS_READY",
      }),
    ).toMatchObject({
      outcome: "APPLIED",
      to_state: "AWAITING_DIRECTION_SELECTION",
      actor: "SERVER",
    });
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_DIRECTION_SELECTION",
        event: "SELECT_DIRECTION",
        idempotencyKey: "idem_select_1",
      }),
    ).toMatchObject({
      outcome: "APPLIED",
      to_state: "ROUTE_LOCKED",
      actor: "CLIENT",
    });
    expect(
      applyGuidedLearningEvent({
        state: "ROUTE_LOCKED",
        event: "START_STAGE",
        idempotencyKey: "idem_start_1",
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "STAGE_IN_PROGRESS" });
    expect(
      applyGuidedLearningEvent({
        state: "STAGE_IN_PROGRESS",
        event: "QUESTIONS_READY",
      }),
    ).toMatchObject({
      outcome: "APPLIED",
      to_state: "AWAITING_ANSWER",
      actor: "SERVER",
    });
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_ANSWER",
        event: "SUBMIT_ANSWER",
        idempotencyKey: "idem_answer_1",
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "ANSWER_SUBMITTED" });
    expect(
      applyGuidedLearningEvent({
        state: "AWAITING_ANSWER",
        event: "SKIP_QUESTION",
        idempotencyKey: "idem_skip_conflict",
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "QUESTION_COMPLETED" });
    expect(
      applyGuidedLearningEvent({
        state: "ANSWER_SUBMITTED",
        event: "SKIP_QUESTION",
        idempotencyKey: "idem_skip_after_answer",
      }),
    ).toMatchObject({ outcome: "REJECTED", reason: "ILLEGAL_TRANSITION" });
    expect(
      applyGuidedLearningEvent({
        state: "ANSWER_SUBMITTED",
        event: "CONFIRM_QUESTION",
        idempotencyKey: "idem_confirm_early",
      }),
    ).toMatchObject({ outcome: "REJECTED", reason: "ILLEGAL_TRANSITION" });
    expect(
      applyGuidedLearningEvent({
        state: "QUESTION_COMPLETED",
        event: "ADVANCE_QUESTION",
        idempotencyKey: "idem_advance_1",
      }),
    ).toMatchObject({
      outcome: "REJECTED",
      reason: "REMAINING_QUESTION_CONTEXT_REQUIRED",
    });
    expect(
      applyGuidedLearningEvent({
        state: "QUESTION_COMPLETED",
        event: "ADVANCE_QUESTION",
        idempotencyKey: "idem_advance_1",
        hasRemainingQuestions: true,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "AWAITING_ANSWER" });
    expect(
      applyGuidedLearningEvent({
        state: "QUESTION_COMPLETED",
        event: "ADVANCE_QUESTION",
        idempotencyKey: "idem_advance_last",
        hasRemainingQuestions: false,
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "STAGE_COMPLETED" });
    expect(
      applyGuidedLearningEvent({
        state: "STAGE_COMPLETED",
        event: "SUMMARY_READY",
      }),
    ).toMatchObject({
      outcome: "APPLIED",
      to_state: "SESSION_COMPLETED",
      actor: "SERVER",
    });
  });

  it("returns idempotent replay results and rejects conflicting key reuse", () => {
    const records = [
      {
        idempotency_key: "idem_answer_1",
        event: "SUBMIT_ANSWER" as const,
        to_state: "ANSWER_SUBMITTED" as const,
      },
    ];
    expect(
      applyGuidedLearningEvent({
        state: "ANSWER_SUBMITTED",
        event: "SUBMIT_ANSWER",
        idempotencyKey: "idem_answer_1",
        idempotencyRecords: records,
      }),
    ).toMatchObject({ outcome: "IDEMPOTENT", to_state: "ANSWER_SUBMITTED" });
    expect(
      applyGuidedLearningEvent({
        state: "ANSWER_SUBMITTED",
        event: "SKIP_QUESTION",
        idempotencyKey: "idem_answer_1",
        idempotencyRecords: records,
      }),
    ).toMatchObject({ outcome: "REJECTED", reason: "IDEMPOTENCY_KEY_REUSED" });
    expect(
      applyGuidedLearningEvent({
        state: "RETRYABLE_FAILURE",
        event: "RETRY",
        idempotencyKey: "idem_retry_1",
      }),
    ).toMatchObject({ outcome: "APPLIED", to_state: "STAGE_IN_PROGRESS" });
    expect(
      applyGuidedLearningEvent({
        state: "FAILED",
        event: "RETRY",
        idempotencyKey: "idem_retry_2",
      }),
    ).toMatchObject({ outcome: "REJECTED", reason: "ILLEGAL_TRANSITION" });
  });

  it("keeps the fixed route server-owned and later stages locked", () => {
    const fixture = readJson(
      resolve(fixtureDirectory, "route-locked.json"),
    ) as {
      session: { route: GuidedLearningRoute };
    };
    expect(isCanonicalGuidedLearningRoute(fixture.session.route)).toBe(true);
  });
});
