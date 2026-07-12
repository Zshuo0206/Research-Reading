import type { ModelGatewayRequest } from "../../../packages/contracts/wave1/src/index.js";

export const contextSpan = {
  context_span_id: "context_method_1",
  document_version_id: "docv_e2e_1",
  page_number: 1,
  char_start: 0,
  char_end: 56,
  text: "The study used interviews and thematic analysis methods.",
  page_text_sha256: "a".repeat(64),
  extraction_profile_version: "fixture-v1",
} as const;

const provider_config = { provider: "MOCK", fixture_id: "default" } as const;
const document_metadata = {
  document_version_id: "docv_e2e_1",
  page_count: 1,
} as const;

export const questionPlanRequest = {
  schema_version: "model-gateway.v1",
  message_kind: "REQUEST",
  operation: "GENERATE_QUESTION_PLAN",
  provider_config,
  input: {
    document_metadata,
    document_language: "en",
    method_learning_mode: "METHOD_LEARNING",
    context_spans: [contextSpan],
  },
} satisfies ModelGatewayRequest;

export const answerRequest = {
  schema_version: "model-gateway.v1",
  message_kind: "REQUEST",
  operation: "GENERATE_ANSWER",
  provider_config,
  input: {
    confirmed_question: {
      question_id: "question_e2e_1",
      revision_id: "qrev_e2e_1",
      text: "Which research methods were used?",
    },
    context_spans: [contextSpan],
    document_metadata,
  },
} satisfies ModelGatewayRequest;

export const connectionTestRequest = {
  schema_version: "model-gateway.v1",
  message_kind: "REQUEST",
  operation: "CONNECTION_TEST",
  provider_config,
  input: { probe: true },
} satisfies ModelGatewayRequest;
