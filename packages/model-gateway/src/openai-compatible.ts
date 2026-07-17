import type {
  ModelGatewayRequest,
  ModelGatewayResponse,
  Provider,
  RuntimeSecretRef,
} from "../../contracts/dist/wave1/src/index.js";
import { PROVIDER_PRESETS } from "../../contracts/dist/wave1/src/index.js";
import {
  RuntimeSecretError,
  type SecretResolver,
} from "../../runtime-secrets/dist/index.js";
import {
  assertCandidateContextSpanIds,
  type ModelGateway,
  ModelGatewayError,
  validateModelGatewayEnvelope,
} from "./index.js";

type ByokRequest = Extract<
  ModelGatewayRequest,
  { runtime_secret_ref: RuntimeSecretRef }
>;
type ByokProvider = Exclude<Provider, "MOCK">;
type FailureCategory =
  | "AUTHENTICATION"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type HttpClient = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ByokGatewayLogEvent {
  event: "byok_request_finished";
  operation: ByokRequest["operation"];
  provider: ByokProvider;
  model: string;
  outcome: "success" | "failure";
  duration_ms: number;
  http_status?: number;
  error_category?: FailureCategory;
  finish_reason?: string | null;
  content_is_null?: boolean;
  content_length?: number;
  reasoning_content_length?: number;
}

export interface ByokGatewayLogger {
  log(event: ByokGatewayLogEvent): void;
}

const NOOP_LOGGER: ByokGatewayLogger = { log: () => undefined };

interface ProviderResponseDiagnostics {
  finish_reason: string | null;
  content_is_null: boolean;
  content_length: number;
  reasoning_content_length: number;
}

type ProviderResponseFailure = ModelGatewayError & {
  readonly diagnostics: ProviderResponseDiagnostics;
};

export class OpenAICompatibleByokGateway implements ModelGateway {
  constructor(
    private readonly secrets: SecretResolver,
    private readonly http: HttpClient = fetch,
    private readonly logger: ByokGatewayLogger = NOOP_LOGGER,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async invoke(request: ModelGatewayRequest): Promise<ModelGatewayResponse> {
    if (!validateModelGatewayEnvelope(request)) {
      throw new ModelGatewayError(
        "INVALID_REQUEST",
        "The BYOK request does not satisfy model-gateway.v1.",
      );
    }
    if (!("runtime_secret_ref" in request)) {
      throw new ModelGatewayError(
        "INVALID_REQUEST",
        "The OpenAI-compatible BYOK gateway requires a runtime secret reference.",
      );
    }

    return this.invokeByok(request);
  }

  private async invokeByok(
    request: ByokRequest,
  ): Promise<ModelGatewayResponse> {
    const startedAt = this.now();
    let status: number | undefined;
    let category: FailureCategory | undefined;
    let responseDiagnostics: ProviderResponseDiagnostics | undefined;

    try {
      validateBaseUrl(
        request.provider_config.provider,
        request.provider_config.base_url,
      );
      const apiKey = this.secrets.resolve(request.runtime_secret_ref);
      const body = createRequestBody(request);
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        request.provider_config.request_timeout_ms,
      );

      let response: Response;
      try {
        response = await this.http(
          `${stripTrailingSlash(request.provider_config.base_url)}/chat/completions`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
        );
      } catch {
        category = controller.signal.aborted ? "TIMEOUT" : "UNAVAILABLE";
        throw new ModelGatewayError(
          category,
          category === "TIMEOUT"
            ? "The model provider request timed out."
            : "The model provider is unavailable.",
        );
      } finally {
        clearTimeout(timeout);
      }

      status = response.status;
      if (!response.ok) {
        category = categoryForStatus(response.status);
        if (request.operation === "CONNECTION_TEST") {
          const result = connectionResponse(request, false, category);
          this.log(request, startedAt, "failure", status, category);
          return result;
        }
        return this.handleFailure(request, category, response.status);
      }

      if (request.operation === "CONNECTION_TEST") {
        const result = connectionResponse(request, true);
        this.log(request, startedAt, "success", status, undefined);
        return result;
      }

      let parsed: ParsedProviderOutput;
      try {
        parsed = await parseOutput(response);
        responseDiagnostics = parsed.diagnostics;
      } catch (error) {
        if (isProviderResponseFailure(error))
          responseDiagnostics = error.diagnostics;
        throw error;
      }
      const result = {
        schema_version: "model-gateway.v1",
        message_kind: "RESPONSE",
        operation: request.operation,
        output: parsed.output,
      } as ModelGatewayResponse;

      if (!validateModelGatewayEnvelope(result)) {
        category = "INVALID_RESPONSE";
        throw new ModelGatewayError(
          "INVALID_RESPONSE",
          "The model provider returned output that does not satisfy model-gateway.v1.",
        );
      }
      if (request.operation === "GENERATE_ANSWER") {
        const answer = result as Extract<
          ModelGatewayResponse,
          { operation: "GENERATE_ANSWER" }
        >;
        assertCandidateContextSpanIds(answer, request.input.context_spans);
      }

      this.log(
        request,
        startedAt,
        "success",
        status,
        undefined,
        responseDiagnostics,
      );
      return result;
    } catch (error) {
      category ??= categoryForError(error);
      if (request.operation === "CONNECTION_TEST") {
        const result = connectionResponse(request, false, category);
        this.log(request, startedAt, "failure", status, category);
        return result;
      }
      this.log(
        request,
        startedAt,
        "failure",
        status,
        category,
        responseDiagnostics,
      );
      if (error instanceof ModelGatewayError) throw error;
      throw new ModelGatewayError(category, safeFailureMessage(category));
    }
  }

  private handleFailure(
    request: ByokRequest,
    category: FailureCategory,
    status: number,
  ): ModelGatewayResponse {
    if (request.operation === "CONNECTION_TEST") {
      return connectionResponse(request, false, category);
    }
    throw new ModelGatewayError(
      category === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : category,
      `${safeFailureMessage(category)} (HTTP ${status})`,
    );
  }

  private log(
    request: ByokRequest,
    startedAt: number,
    outcome: "success" | "failure",
    httpStatus?: number,
    errorCategory?: FailureCategory,
    responseDiagnostics?: ProviderResponseDiagnostics,
  ): void {
    this.logger.log({
      event: "byok_request_finished",
      operation: request.operation,
      provider: request.provider_config.provider,
      model: request.provider_config.model,
      outcome,
      duration_ms: Math.max(0, this.now() - startedAt),
      ...(httpStatus === undefined ? {} : { http_status: httpStatus }),
      ...(errorCategory === undefined ? {} : { error_category: errorCategory }),
      ...(responseDiagnostics ?? {}),
    });
  }
}

function validateBaseUrl(provider: ByokProvider, baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ModelGatewayError(
      "INVALID_REQUEST",
      "Provider base_url is invalid.",
    );
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new ModelGatewayError(
      "INVALID_REQUEST",
      "Provider base_url must be HTTPS and must not contain a query or fragment.",
    );
  }
  if (provider !== "CUSTOM_OPENAI_COMPATIBLE") {
    const expected = PROVIDER_PRESETS[provider];
    if (stripTrailingSlash(baseUrl) !== expected) {
      throw new ModelGatewayError(
        "INVALID_REQUEST",
        `${provider} must use its frozen provider preset base_url.`,
      );
    }
  }
}

function createRequestBody(request: ByokRequest): Record<string, unknown> {
  if (request.operation === "CONNECTION_TEST") {
    return {
      model: request.provider_config.model,
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 1,
    };
  }

  const outputRequirements = guidedOutputInstructions(request.operation);
  const input = JSON.stringify(
    {
      operation: request.operation,
      output_requirements: outputRequirements,
      input: request.input,
    },
    null,
    2,
  );
  if (Array.from(input).length > request.provider_config.max_input_characters) {
    throw new ModelGatewayError(
      "INVALID_REQUEST",
      "Model input exceeds max_input_characters.",
    );
  }
  return {
    model: request.provider_config.model,
    messages: [
      {
        role: "system",
        content: `Return exactly one valid JSON object. The response must contain JSON only. Follow the operation-specific output_requirements exactly. Here is a complete JSON example for this operation: ${JSON.stringify(outputRequirements.example)}. Cite only supplied context_span_id values; do not add fields, Markdown, code fences, IDs, page numbers, offsets, hashes, or provider metadata.`,
      },
      { role: "user", content: input },
    ],
    response_format: { type: "json_object" },
    max_tokens: request.provider_config.max_output_tokens,
    ...(isDeepSeekStructuredRequest(request)
      ? { thinking: { type: "disabled" } }
      : {}),
  };
}

function guidedOutputInstructions(operation: ByokRequest["operation"]): {
  shape: Record<string, unknown>;
  example: Record<string, unknown>;
  constraints: string[];
} {
  switch (operation) {
    case "GENERATE_QUESTION_PLAN":
      return {
        shape: {
          document_language: "string",
          retrieval_queries: ["string"],
          retrieval_terms: ["string"],
          questions: [{ text: "string" }],
        },
        example: {
          document_language: "en",
          retrieval_queries: ["study method"],
          retrieval_terms: ["method"],
          questions: [{ text: "What method does the paper use?" }],
        },
        constraints: [
          "return valid JSON",
          "no Markdown",
          "no extra explanation",
        ],
      };
    case "GENERATE_ANSWER":
      return {
        shape: {
          status: "SUCCESS | INSUFFICIENT_EVIDENCE",
          claims: [
            {
              text: "string",
              claim_type:
                "PAPER_FACT | AUTHOR_CLAIM | AGENT_INFERENCE | INSUFFICIENT_EVIDENCE",
              candidate_context_span_ids: ["string"],
            },
          ],
        },
        example: {
          status: "SUCCESS",
          claims: [
            {
              text: "The paper uses the stated method.",
              claim_type: "PAPER_FACT",
              candidate_context_span_ids: ["context_example"],
            },
          ],
        },
        constraints: [
          "cite only supplied context_span_id values",
          "use an empty claim reference for INSUFFICIENT_EVIDENCE",
          "no Markdown or extra explanation",
        ],
      };
    case "GENERATE_GUIDED_DIRECTIONS":
      return {
        shape: {
          directions: [
            {
              title: "string",
              description: "string",
              selection_basis: "string",
            },
          ],
        },
        example: {
          directions: [
            {
              title: "Method design",
              description: "Trace the study method.",
              selection_basis: "It matches the learning goal.",
            },
            {
              title: "Evidence chain",
              description: "Trace evidence to conclusions.",
              selection_basis: "It supports source review.",
            },
          ],
        },
        constraints: [
          "return 2 to 3 items",
          "do not return direction_id",
          "no Markdown",
          "no extra explanation",
        ],
      };
    case "GENERATE_GUIDED_QUESTIONS":
      return {
        shape: { questions: [{ text: "string" }] },
        example: {
          questions: [
            { text: "What method does the paper use?" },
            { text: "What evidence supports the method?" },
            { text: "How does the method affect the conclusion?" },
          ],
        },
        constraints: [
          "return 3 to 7 open-ended questions",
          "progress from basic understanding to deeper reasoning",
          "use only supplied paper context",
          "do not return answers, IDs, Markdown, or extra explanation",
        ],
      };
    case "GENERATE_GUIDED_FEEDBACK":
      return {
        shape: {
          status: "SUCCESS | INSUFFICIENT_EVIDENCE",
          summary: "string",
          omissions: ["string"],
          reference_answer: "string",
          claims: [
            {
              text: "string",
              claim_type:
                "PAPER_FACT | AUTHOR_CLAIM | AGENT_INFERENCE | INSUFFICIENT_EVIDENCE",
              context_span_id: "string",
              evidence_quote_candidate: "string",
            },
          ],
        },
        example: {
          status: "SUCCESS",
          summary: "The answer identifies the method.",
          omissions: ["The answer does not discuss the limitation."],
          reference_answer: "The paper uses the stated method.",
          claims: [
            {
              text: "The paper uses the stated method.",
              claim_type: "PAPER_FACT",
              context_span_id: "context_example",
              evidence_quote_candidate: "The paper uses the stated method.",
            },
          ],
        },
        constraints: [
          "supported claims must cite supplied context_span_id",
          "quote must be an exact continuous quote from that span",
          "never return page number, char offset, hash, or Markdown",
          "use INSUFFICIENT_EVIDENCE when reliable evidence is unavailable",
          "no extra fields",
        ],
      };
    case "GENERATE_GUIDED_STAGE_SUMMARY":
      return {
        shape: {
          key_mastery_points: ["string"],
          major_weak_points: ["string"],
          next_stage_hint: "string",
        },
        example: {
          key_mastery_points: ["The learner can explain the method."],
          major_weak_points: [
            "The learner needs to connect evidence to conclusions.",
          ],
          next_stage_hint: "Review the evidence chain.",
        },
        constraints: [
          "base the summary on question_history",
          "do not return scores or mastery levels",
          "do not return completed or skipped question orders",
          "do not open ANALYZE or TRANSFER",
          "no Markdown or extra explanation",
        ],
      };
    default:
      return { shape: {}, example: {}, constraints: ["no extra fields"] };
  }
}

function isDeepSeekStructuredRequest(request: ByokRequest): boolean {
  if (
    request.operation === "CONNECTION_TEST" ||
    request.provider_config.provider !== "CUSTOM_OPENAI_COMPATIBLE"
  )
    return false;
  try {
    return (
      new URL(request.provider_config.base_url).hostname.toLowerCase() ===
      "api.deepseek.com"
    );
  } catch {
    return false;
  }
}

interface ParsedProviderOutput {
  output: unknown;
  diagnostics: ProviderResponseDiagnostics;
}

async function parseOutput(response: Response): Promise<ParsedProviderOutput> {
  const emptyDiagnostics: ProviderResponseDiagnostics = {
    finish_reason: null,
    content_is_null: true,
    content_length: 0,
    reasoning_content_length: 0,
  };
  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    throw providerResponseError(
      "The model provider response was not valid JSON.",
      emptyDiagnostics,
    );
  }
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !Array.isArray((envelope as { choices?: unknown }).choices)
  ) {
    throw providerResponseError(
      "The model provider response schema is invalid.",
      emptyDiagnostics,
    );
  }
  const choice = (envelope as { choices: unknown[] }).choices[0];
  if (typeof choice !== "object" || choice === null) {
    throw providerResponseError(
      "The model provider response schema is invalid.",
      emptyDiagnostics,
    );
  }
  const message = (choice as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    throw providerResponseError(
      "The model provider response schema is invalid.",
      emptyDiagnostics,
    );
  }
  const finishReason = (choice as { finish_reason?: unknown }).finish_reason;
  const content = (message as { content?: unknown }).content;
  const reasoningContent = (message as { reasoning_content?: unknown })
    .reasoning_content;
  const diagnostics: ProviderResponseDiagnostics = {
    finish_reason: typeof finishReason === "string" ? finishReason : null,
    content_is_null: content === null,
    content_length:
      typeof content === "string" ? Array.from(content).length : 0,
    reasoning_content_length:
      typeof reasoningContent === "string"
        ? Array.from(reasoningContent).length
        : 0,
  };
  if (diagnostics.finish_reason === "length") {
    throw providerResponseError(
      "The model provider response was truncated (finish_reason=length).",
      diagnostics,
    );
  }
  if (typeof content !== "string" || content.trim().length === 0) {
    throw providerResponseError(
      "The model provider returned empty JSON message content.",
      diagnostics,
    );
  }
  const normalized = normalizeJsonContent(content);
  try {
    return { output: JSON.parse(normalized) as unknown, diagnostics };
  } catch {
    throw providerResponseError(
      "The model provider message content was not valid JSON.",
      diagnostics,
    );
  }
}

function providerResponseError(
  message: string,
  diagnostics: ProviderResponseDiagnostics,
): ProviderResponseFailure {
  const error = new ModelGatewayError(
    "INVALID_RESPONSE",
    message,
  ) as ProviderResponseFailure;
  Object.defineProperty(error, "diagnostics", {
    configurable: false,
    enumerable: false,
    value: diagnostics,
    writable: false,
  });
  return error;
}

function isProviderResponseFailure(
  error: unknown,
): error is ProviderResponseFailure {
  return error instanceof ModelGatewayError && "diagnostics" in error;
}

function normalizeJsonContent(content: string): string {
  const trimmed = content.trim();
  return trimmed.charCodeAt(0) === 0xfeff ? trimmed.slice(1).trim() : trimmed;
}

function connectionResponse(
  request: ByokRequest,
  success: boolean,
  category?: FailureCategory,
): ModelGatewayResponse {
  return {
    schema_version: "model-gateway.v1",
    message_kind: "RESPONSE",
    operation: "CONNECTION_TEST",
    output: success
      ? {
          success: true,
          provider: request.provider_config.provider,
          model: request.provider_config.model,
        }
      : {
          success: false,
          provider: request.provider_config.provider,
          model: request.provider_config.model,
          error_category: category ?? "UNKNOWN",
          error_message: safeFailureMessage(category ?? "UNKNOWN"),
        },
  };
}

function categoryForStatus(status: number): FailureCategory {
  if (status === 401 || status === 403) return "AUTHENTICATION";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "UNAVAILABLE";
  return "UNKNOWN";
}

function categoryForError(error: unknown): FailureCategory {
  if (isRuntimeSecretError(error)) return "AUTHENTICATION";
  if (error instanceof ModelGatewayError) {
    if (error.code === "INVALID_REQUEST") return "UNKNOWN";
    if (error.code === "PROVIDER_NOT_IMPLEMENTED") return "UNKNOWN";
    if (error.code === "UNKNOWN_CANDIDATE_CONTEXT_SPAN")
      return "INVALID_RESPONSE";
    return error.code;
  }
  return "UNKNOWN";
}

function isRuntimeSecretError(error: unknown): boolean {
  if (error instanceof RuntimeSecretError) return true;
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return (
    candidate.name === "RuntimeSecretError" &&
    (candidate.code === "INVALID_SECRET" ||
      candidate.code === "SECRET_NOT_FOUND")
  );
}

function safeFailureMessage(category: FailureCategory): string {
  switch (category) {
    case "AUTHENTICATION":
      return "The provider rejected the runtime API key.";
    case "RATE_LIMIT":
      return "The provider rate limit was reached.";
    case "TIMEOUT":
      return "The provider request timed out.";
    case "INVALID_RESPONSE":
      return "The provider returned an invalid response.";
    case "UNAVAILABLE":
      return "The provider is unavailable.";
    case "UNKNOWN":
      return "The provider request failed.";
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
