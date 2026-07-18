import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";

import answerSchema from "../../../packages/contracts/wave1/answer.v1.schema.json" with {
  type: "json",
};
import evidenceSchema from "../../../packages/contracts/wave1/evidence.v1.schema.json" with {
  type: "json",
};
import modelGatewaySchema from "../../../packages/contracts/wave1/model-gateway.v1.schema.json" with {
  type: "json",
};
import questionPlanSchema from "../../../packages/contracts/wave1/question-plan.v1.schema.json" with {
  type: "json",
};
import {
  type AnswerResponse,
  assertCandidateContextSpanIds,
  ByokModelGatewaySeam,
  MockModelGateway,
  ModelGatewayError,
} from "../../../packages/model-gateway/src/index.js";
import {
  answerRequest,
  connectionTestRequest,
  contextSpan,
  questionPlanRequest,
} from "../../fixtures/model/requests.js";

const Ajv2020 = Ajv2020Module.default;
const addFormats = addFormatsModule.default;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(evidenceSchema);
ajv.addSchema(questionPlanSchema);
ajv.addSchema(answerSchema);
const validate = ajv.compile(modelGatewaySchema);

describe("MockModelGateway", () => {
  const gateway = new MockModelGateway();

  it("supports all three operations and emits canonical-schema-valid responses", async () => {
    for (const request of [
      questionPlanRequest,
      answerRequest,
      connectionTestRequest,
    ]) {
      const response = await gateway.invoke(request);
      expect(validate(response), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it("returns a draft-only deterministic method-learning question plan", async () => {
    const first = await gateway.invoke(questionPlanRequest);
    const second = await gateway.invoke(structuredClone(questionPlanRequest));
    expect(first).toEqual(second);
    expect(first.operation).toBe("GENERATE_QUESTION_PLAN");
    if (first.operation !== "GENERATE_QUESTION_PLAN")
      throw new Error("narrowing failed");
    expect(first.output.questions.length).toBeGreaterThan(0);
    expect(first.output.questions[0].text.toLowerCase()).toContain("method");
    expect(JSON.stringify(first.output)).not.toMatch(
      /question_id|revision|timestamp|created_at|hash|review_status/,
    );
  });

  it("answers from server-provided context using candidate IDs without coordinates", async () => {
    const response = await gateway.invoke(answerRequest);
    expect(response.operation).toBe("GENERATE_ANSWER");
    if (response.operation !== "GENERATE_ANSWER")
      throw new Error("narrowing failed");
    expect(response.output.status).toBe("SUCCESS");
    expect(response.output.claims[0]).toEqual(
      expect.objectContaining({
        claim_type: "PAPER_FACT",
        candidate_context_span_ids: [contextSpan.context_span_id],
      }),
    );
    expect(JSON.stringify(response.output)).not.toMatch(
      /char_start|char_end|evidence_span/,
    );
  });

  it("returns the contract refusal shape for insufficient evidence", async () => {
    const request = {
      ...structuredClone(answerRequest),
      provider_config: {
        ...answerRequest.provider_config,
        fixture_id: "answer-insufficient",
      },
    };
    const response = await gateway.invoke(request);
    expect(response.operation).toBe("GENERATE_ANSWER");
    if (response.operation !== "GENERATE_ANSWER")
      throw new Error("narrowing failed");
    expect(response.output).toEqual({
      status: "INSUFFICIENT_EVIDENCE",
      claims: [
        expect.objectContaining({
          claim_type: "INSUFFICIENT_EVIDENCE",
          candidate_context_span_ids: [],
        }),
      ],
    });
    expect(validate(response), JSON.stringify(validate.errors)).toBe(true);
  });

  it("emits a guided PAPER_FACT that is limited to an exact canonical quote", async () => {
    const response = await gateway.invoke({
      schema_version: "model-gateway.v1",
      message_kind: "REQUEST",
      operation: "GENERATE_GUIDED_FEEDBACK",
      provider_config: { provider: "MOCK", fixture_id: "guided-learning-v1" },
      input: {
        learning_goal: "理解论文方法",
        document_metadata: {
          document_version_id: contextSpan.document_version_id,
          page_count: 1,
        },
        context_spans: [contextSpan],
      },
    });
    expect(response.operation).toBe("GENERATE_GUIDED_FEEDBACK");
    if (response.operation !== "GENERATE_GUIDED_FEEDBACK")
      throw new Error("narrowing failed");
    const quote = response.output.claims[0]?.evidence_quote_candidate ?? "";
    expect(response.output.status).toBe("SUCCESS");
    expect(quote.length).toBeGreaterThanOrEqual(3);
    expect(contextSpan.text.includes(quote)).toBe(true);
    expect(response.output.claims[0]).toMatchObject({
      claim_type: "PAPER_FACT",
      context_span_id: contextSpan.context_span_id,
      text: expect.stringContaining(quote),
    });
    expect(validate(response), JSON.stringify(validate.errors)).toBe(true);
  });

  it("returns guided insufficient evidence when no unique eligible quote exists", async () => {
    const response = await gateway.invoke({
      schema_version: "model-gateway.v1",
      message_kind: "REQUEST",
      operation: "GENERATE_GUIDED_FEEDBACK",
      provider_config: { provider: "MOCK", fixture_id: "guided-learning-v1" },
      input: {
        learning_goal: "理解论文方法",
        document_metadata: {
          document_version_id: contextSpan.document_version_id,
          page_count: 1,
        },
        context_spans: [{ ...contextSpan, text: "x" }],
      },
    });
    expect(response.operation).toBe("GENERATE_GUIDED_FEEDBACK");
    if (response.operation !== "GENERATE_GUIDED_FEEDBACK")
      throw new Error("narrowing failed");
    expect(response.output).toMatchObject({
      status: "INSUFFICIENT_EVIDENCE",
      claims: [
        {
          claim_type: "INSUFFICIENT_EVIDENCE",
          context_span_id: contextSpan.context_span_id,
          evidence_quote_candidate: "",
        },
      ],
    });
    expect(validate(response), JSON.stringify(validate.errors)).toBe(true);
  });

  it("rejects invalid input before generation", async () => {
    const invalid = { ...questionPlanRequest, schema_version: "wrong" };
    await expect(gateway.invoke(invalid as never)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("rejects candidate IDs absent from the supplied server context", () => {
    const response = {
      schema_version: "model-gateway.v1",
      message_kind: "RESPONSE",
      operation: "GENERATE_ANSWER",
      output: {
        status: "SUCCESS",
        claims: [
          {
            text: "Unsupported candidate reference",
            claim_type: "AUTHOR_CLAIM",
            candidate_context_span_ids: ["context_missing"],
          },
        ],
      },
    } satisfies AnswerResponse;
    expect(() =>
      assertCandidateContextSpanIds(response, [contextSpan]),
    ).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_CANDIDATE_CONTEXT_SPAN" }),
    );
  });

  it("keeps non-Mock providers behind an explicit unimplemented BYOK seam", async () => {
    const seam = new ByokModelGatewaySeam();
    await expect(seam.invoke(questionPlanRequest)).rejects.toBeInstanceOf(
      ModelGatewayError,
    );
  });
});
