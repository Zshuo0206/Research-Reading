export interface WorkflowModelGateway {
  invoke(request: unknown): Promise<unknown>;
}

export interface QuestionPlanJobPayload {
  documentVersionId: string;
  documentLanguage: string;
  pageCount: number;
  contextSpans: unknown[];
  providerConfig: { provider: "MOCK"; fixture_id: string };
}

export interface AnswerGenerationJobPayload {
  question: { questionId: string; revisionId: string; text: string };
  documentVersionId: string;
  pageCount: number;
  contextSpans: unknown[];
  providerConfig: { provider: "MOCK"; fixture_id: string };
}

export function createQuestionPlanJobHandler(gateway: WorkflowModelGateway) {
  return async (payload: unknown): Promise<unknown> => {
    const input = parseQuestionPlanPayload(payload);
    const response = await gateway.invoke({
      schema_version: "model-gateway.v1",
      message_kind: "REQUEST",
      operation: "GENERATE_QUESTION_PLAN",
      provider_config: input.providerConfig,
      input: {
        document_metadata: {
          document_version_id: input.documentVersionId,
          page_count: input.pageCount,
        },
        document_language: input.documentLanguage,
        method_learning_mode: "METHOD_LEARNING",
        context_spans: input.contextSpans,
      },
    });
    return extractOutput(response, "GENERATE_QUESTION_PLAN");
  };
}

export function createAnswerGenerationJobHandler(
  gateway: WorkflowModelGateway,
) {
  return async (payload: unknown): Promise<unknown> => {
    const input = parseAnswerPayload(payload);
    const response = await gateway.invoke({
      schema_version: "model-gateway.v1",
      message_kind: "REQUEST",
      operation: "GENERATE_ANSWER",
      provider_config: input.providerConfig,
      input: {
        confirmed_question: {
          question_id: input.question.questionId,
          revision_id: input.question.revisionId,
          text: input.question.text,
        },
        context_spans: input.contextSpans,
        document_metadata: {
          document_version_id: input.documentVersionId,
          page_count: input.pageCount,
        },
      },
    });
    return extractOutput(response, "GENERATE_ANSWER");
  };
}

function parseQuestionPlanPayload(value: unknown): QuestionPlanJobPayload {
  if (
    !isRecord(value) ||
    typeof value.documentVersionId !== "string" ||
    typeof value.documentLanguage !== "string" ||
    !Number.isInteger(value.pageCount) ||
    !Array.isArray(value.contextSpans) ||
    !isMockProvider(value.providerConfig)
  )
    throw new Error("Invalid QUESTION_PLAN workflow payload");
  return value as unknown as QuestionPlanJobPayload;
}

function parseAnswerPayload(value: unknown): AnswerGenerationJobPayload {
  if (
    !isRecord(value) ||
    !isRecord(value.question) ||
    typeof value.question.questionId !== "string" ||
    typeof value.question.revisionId !== "string" ||
    typeof value.question.text !== "string" ||
    typeof value.documentVersionId !== "string" ||
    !Number.isInteger(value.pageCount) ||
    !Array.isArray(value.contextSpans) ||
    !isMockProvider(value.providerConfig)
  )
    throw new Error("Invalid ANSWER_GENERATION workflow payload");
  return value as unknown as AnswerGenerationJobPayload;
}

function extractOutput(
  value: unknown,
  operation: "GENERATE_QUESTION_PLAN" | "GENERATE_ANSWER",
): unknown {
  if (
    !isRecord(value) ||
    value.schema_version !== "model-gateway.v1" ||
    value.message_kind !== "RESPONSE" ||
    value.operation !== operation ||
    !("output" in value)
  )
    throw new Error(`ModelGateway returned an invalid ${operation} response`);
  return value.output;
}

function isMockProvider(
  value: unknown,
): value is { provider: "MOCK"; fixture_id: string } {
  return (
    isRecord(value) &&
    value.provider === "MOCK" &&
    typeof value.fixture_id === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
