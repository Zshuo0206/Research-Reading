import { describe, expect, it, vi } from "vitest";
import type { ModelGatewayRequest } from "../../../packages/contracts/wave1/src/index.js";
import {
  type ByokGatewayLogEvent,
  type HttpClient,
  ModelGatewayError,
  OpenAICompatibleByokGateway,
} from "../../../packages/model-gateway/src/index.js";
import {
  RuntimeSecretResolver,
  SessionMemorySecretStore,
} from "../../../packages/runtime-secrets/src/index.js";

const contextSpan = {
  context_span_id: "context_method",
  document_version_id: "docv_method",
  page_number: 1,
  char_start: 0,
  char_end: 12,
  text: "Random trial",
  page_text_sha256: "a".repeat(64),
  extraction_profile_version: "pdfjs-text-v1",
};

const providerConfig = {
  provider: "OPENAI",
  base_url: "https://api.openai.com/v1",
  model: "test-model",
  request_timeout_ms: 1_000,
  max_input_characters: 10_000,
  max_output_tokens: 500,
} as const;

const questionRequest = {
  schema_version: "model-gateway.v1",
  message_kind: "REQUEST",
  operation: "GENERATE_QUESTION_PLAN",
  provider_config: providerConfig,
  runtime_secret_ref: { kind: "ENVIRONMENT", name: "TEST_BYOK_TOKEN" },
  input: {
    document_metadata: { document_version_id: "docv_method", page_count: 1 },
    document_language: "en",
    method_learning_mode: "METHOD_LEARNING",
    context_spans: [contextSpan],
  },
} satisfies ModelGatewayRequest;

const connectionRequest = {
  schema_version: "model-gateway.v1",
  message_kind: "REQUEST",
  operation: "CONNECTION_TEST",
  provider_config: providerConfig,
  runtime_secret_ref: { kind: "ENVIRONMENT", name: "TEST_BYOK_TOKEN" },
  input: { probe: true },
} satisfies ModelGatewayRequest;

const answerRequest = {
  schema_version: "model-gateway.v1",
  message_kind: "REQUEST",
  operation: "GENERATE_ANSWER",
  provider_config: providerConfig,
  runtime_secret_ref: { kind: "ENVIRONMENT", name: "TEST_BYOK_TOKEN" },
  input: {
    confirmed_question: {
      question_id: "question_method",
      revision_id: "qrev_method",
      text: "Which randomization method was used?",
    },
    context_spans: [contextSpan],
    document_metadata: { document_version_id: "docv_method", page_count: 1 },
  },
} satisfies ModelGatewayRequest;

function openAiResponse(output: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(output) } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("OpenAI-compatible BYOK gateway", () => {
  it("posts a shallow deterministic request and validates question output", async () => {
    const http = vi.fn<HttpClient>(async () =>
      openAiResponse({
        document_language: "en",
        retrieval_queries: ["random trial method"],
        retrieval_terms: ["random", "trial"],
        questions: [{ text: "Which randomization method was used?" }],
      }),
    );
    const gateway = createGateway(http);

    const response = await gateway.invoke(questionRequest);

    expect(response).toMatchObject({
      message_kind: "RESPONSE",
      operation: "GENERATE_QUESTION_PLAN",
    });
    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer unit.test/token",
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "test-model",
      max_tokens: 500,
      response_format: { type: "json_object" },
    });
  });

  it("maps invalid provider JSON to a deterministic gateway failure", async () => {
    const http: HttpClient = async () =>
      new Response(JSON.stringify({ choices: [] }), { status: 200 });
    const gateway = createGateway(http);

    await expect(gateway.invoke(questionRequest)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("accepts answer drafts that cite only server-provided context IDs", async () => {
    const gateway = createGateway(async () =>
      openAiResponse({
        status: "SUCCESS",
        claims: [
          {
            text: "The paper reports a random trial.",
            claim_type: "PAPER_FACT",
            candidate_context_span_ids: ["context_method"],
          },
        ],
      }),
    );

    await expect(gateway.invoke(answerRequest)).resolves.toMatchObject({
      operation: "GENERATE_ANSWER",
      output: {
        status: "SUCCESS",
        claims: [{ candidate_context_span_ids: ["context_method"] }],
      },
    });
  });

  it("returns a contract connection-test success without parsing model text", async () => {
    const gateway = createGateway(
      async () => new Response("provider-specific success", { status: 200 }),
    );

    await expect(gateway.invoke(connectionRequest)).resolves.toEqual({
      schema_version: "model-gateway.v1",
      message_kind: "RESPONSE",
      operation: "CONNECTION_TEST",
      output: {
        success: true,
        provider: "OPENAI",
        model: "test-model",
      },
    });
  });

  it.each([
    [401, "AUTHENTICATION"],
    [429, "RATE_LIMIT"],
    [503, "UNAVAILABLE"],
  ] as const)("maps HTTP %i to a redacted connection-test %s failure", async (status, category) => {
    const logs: ByokGatewayLogEvent[] = [];
    const gateway = createGateway(
      async () =>
        new Response("unit.test/token must never be logged", { status }),
      logs,
    );

    const response = await gateway.invoke(connectionRequest);

    expect(response).toMatchObject({
      operation: "CONNECTION_TEST",
      output: { success: false, error_category: category },
    });
    expect(JSON.stringify(response)).not.toContain("unit.test/token");
    expect(JSON.stringify(logs)).not.toContain("unit.test/token");
    expect(logs).toEqual([
      expect.objectContaining({
        event: "byok_request_finished",
        outcome: "failure",
        http_status: status,
        error_category: category,
      }),
    ]);
  });

  it("rejects a non-preset base URL before HTTP execution", async () => {
    const http = vi.fn<HttpClient>();
    const gateway = createGateway(http);
    const invalid = {
      ...questionRequest,
      provider_config: {
        ...questionRequest.provider_config,
        base_url: "https://example.invalid/v1",
      },
    };

    await expect(gateway.invoke(invalid)).rejects.toBeInstanceOf(
      ModelGatewayError,
    );
    expect(http).not.toHaveBeenCalled();
  });
});

function createGateway(
  http: HttpClient,
  logs: ByokGatewayLogEvent[] = [],
): OpenAICompatibleByokGateway {
  const sessions = new SessionMemorySecretStore();
  const secrets = new RuntimeSecretResolver(sessions, {
    TEST_BYOK_TOKEN: "unit.test/token",
  });
  return new OpenAICompatibleByokGateway(secrets, http, {
    log: (event) => logs.push(event),
  });
}
