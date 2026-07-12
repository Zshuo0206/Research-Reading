import Ajv2020Module, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

import type {
  ContextSpan,
  ModelGatewayRequest,
  ModelGatewayResponse,
} from "../../contracts/wave1/src/index.js";
import answerSchema from "../../contracts/wave1/answer.v1.schema.json" with {
  type: "json",
};
import evidenceSchema from "../../contracts/wave1/evidence.v1.schema.json" with {
  type: "json",
};
import modelGatewaySchema from "../../contracts/wave1/model-gateway.v1.schema.json" with {
  type: "json",
};
import questionPlanSchema from "../../contracts/wave1/question-plan.v1.schema.json" with {
  type: "json",
};

export type QuestionPlanRequest = Extract<
  ModelGatewayRequest,
  { operation: "GENERATE_QUESTION_PLAN" }
>;
export type AnswerRequest = Extract<
  ModelGatewayRequest,
  { operation: "GENERATE_ANSWER" }
>;
export type ConnectionTestRequest = Extract<
  ModelGatewayRequest,
  { operation: "CONNECTION_TEST" }
>;

export type QuestionPlanResponse = Extract<
  ModelGatewayResponse,
  { operation: "GENERATE_QUESTION_PLAN" }
>;
export type AnswerResponse = Extract<
  ModelGatewayResponse,
  { operation: "GENERATE_ANSWER" }
>;
export type ConnectionTestResponse = Extract<
  ModelGatewayResponse,
  { operation: "CONNECTION_TEST" }
>;

export class ModelGatewayError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "INVALID_RESPONSE"
      | "UNKNOWN_CANDIDATE_CONTEXT_SPAN"
      | "PROVIDER_NOT_IMPLEMENTED",
    message: string,
    readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = "ModelGatewayError";
  }
}

export interface ModelGateway {
  invoke(request: ModelGatewayRequest): Promise<ModelGatewayResponse>;
}

export class ByokModelGatewaySeam implements ModelGateway {
  async invoke(_request: ModelGatewayRequest): Promise<ModelGatewayResponse> {
    throw new ModelGatewayError(
      "PROVIDER_NOT_IMPLEMENTED",
      "Real BYOK provider calls are not implemented by the deterministic Mock gateway.",
    );
  }
}

function createValidator(): ValidateFunction {
  const Ajv2020 = Ajv2020Module.default;
  const addFormats = addFormatsModule.default;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(evidenceSchema);
  ajv.addSchema(questionPlanSchema);
  ajv.addSchema(answerSchema);
  return ajv.compile(modelGatewaySchema);
}

const validateEnvelope = createValidator();

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(
    ({ instancePath, message }) =>
      `${instancePath || "/"} ${message ?? "is invalid"}`,
  );
}

function assertEnvelope(
  value: unknown,
  code: "INVALID_REQUEST" | "INVALID_RESPONSE",
): asserts value is ModelGatewayRequest | ModelGatewayResponse {
  if (!validateEnvelope(value)) {
    const details = formatErrors(validateEnvelope.errors);
    throw new ModelGatewayError(
      code,
      `${code}: ${details.join("; ")}`,
      details,
    );
  }
}

function assertMockRequest(
  request: ModelGatewayRequest,
): asserts request is ModelGatewayRequest & {
  provider_config: { provider: "MOCK"; fixture_id: string };
} {
  if (request.provider_config.provider !== "MOCK") {
    throw new ModelGatewayError(
      "PROVIDER_NOT_IMPLEMENTED",
      `Provider ${request.provider_config.provider} requires a BYOK adapter.`,
    );
  }
}

function questionPlan(request: QuestionPlanRequest): QuestionPlanResponse {
  const language = request.input.document_language;
  return {
    schema_version: "model-gateway.v1",
    message_kind: "RESPONSE",
    operation: "GENERATE_QUESTION_PLAN",
    output: {
      document_language: language,
      retrieval_queries: ["research method study design data analysis"],
      retrieval_terms: ["method", "study design", "data analysis"],
      questions: [
        {
          text: language.toLowerCase().startsWith("zh")
            ? "本文采用了什么研究方法，该方法如何支持研究结论？"
            : "What research method does the paper use, and how does it support the conclusions?",
        },
      ],
    },
  };
}

function answer(request: AnswerRequest, fixtureId: string): AnswerResponse {
  const { context_spans: spans, confirmed_question: question } = request.input;
  const insufficient =
    fixtureId === "answer-insufficient" ||
    spans.every((span) => span.text.trim().length === 0);

  if (insufficient) {
    return {
      schema_version: "model-gateway.v1",
      message_kind: "RESPONSE",
      operation: "GENERATE_ANSWER",
      output: {
        status: "INSUFFICIENT_EVIDENCE",
        claims: [
          {
            text: `The supplied context is insufficient to answer: ${question.text}`,
            claim_type: "INSUFFICIENT_EVIDENCE",
            candidate_context_span_ids: [],
          },
        ],
      },
    };
  }

  return {
    schema_version: "model-gateway.v1",
    message_kind: "RESPONSE",
    operation: "GENERATE_ANSWER",
    output: {
      status: "SUCCESS",
      claims: [
        {
          text: `The supplied context reports: ${spans[0].text}`,
          claim_type: "PAPER_FACT",
          candidate_context_span_ids: [spans[0].context_span_id],
        },
      ],
    },
  };
}

function connectionTest(): ConnectionTestResponse {
  return {
    schema_version: "model-gateway.v1",
    message_kind: "RESPONSE",
    operation: "CONNECTION_TEST",
    output: { success: true, provider: "MOCK", model: "deterministic-mock-v1" },
  };
}

export function assertCandidateContextSpanIds(
  response: AnswerResponse,
  availableSpans: readonly ContextSpan[],
): void {
  const available = new Set(availableSpans.map((span) => span.context_span_id));
  const unknown = response.output.claims.flatMap((claim) =>
    claim.candidate_context_span_ids.filter((id) => !available.has(id)),
  );
  if (unknown.length > 0) {
    throw new ModelGatewayError(
      "UNKNOWN_CANDIDATE_CONTEXT_SPAN",
      `Model response referenced unavailable context span(s): ${[...new Set(unknown)].join(", ")}`,
      [...new Set(unknown)],
    );
  }
}

export class MockModelGateway implements ModelGateway {
  async invoke(request: ModelGatewayRequest): Promise<ModelGatewayResponse> {
    assertEnvelope(request, "INVALID_REQUEST");
    assertMockRequest(request);

    let response: ModelGatewayResponse;
    switch (request.operation) {
      case "GENERATE_QUESTION_PLAN":
        response = questionPlan(request);
        break;
      case "GENERATE_ANSWER":
        response = answer(request, request.provider_config.fixture_id);
        assertCandidateContextSpanIds(response, request.input.context_spans);
        break;
      case "CONNECTION_TEST":
        response = connectionTest();
        break;
    }

    assertEnvelope(response, "INVALID_RESPONSE");
    return response;
  }
}

export function validateModelGatewayEnvelope(value: unknown): boolean {
  return validateEnvelope(value);
}
