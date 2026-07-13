import type {
  ModelGatewayRequest,
  ModelGatewayResponse,
  Provider,
  RuntimeSecretRef,
} from "../../contracts/wave1/src/index.js";
import { PROVIDER_PRESETS } from "../../contracts/wave1/src/index.js";
import {
  RuntimeSecretError,
  type SecretResolver,
} from "../../runtime-secrets/src/index.js";
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
}

export interface ByokGatewayLogger {
  log(event: ByokGatewayLogEvent): void;
}

const NOOP_LOGGER: ByokGatewayLogger = { log: () => undefined };

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
        this.log(request, startedAt, "success", status);
        return result;
      }

      const output = await parseOutput(response);
      const result = {
        schema_version: "model-gateway.v1",
        message_kind: "RESPONSE",
        operation: request.operation,
        output,
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

      this.log(request, startedAt, "success", status);
      return result;
    } catch (error) {
      category ??= categoryForError(error);
      if (request.operation === "CONNECTION_TEST") {
        const result = connectionResponse(request, false, category);
        this.log(request, startedAt, "failure", status, category);
        return result;
      }
      this.log(request, startedAt, "failure", status, category);
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

  const input = JSON.stringify(request.input);
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
        content:
          "Return one JSON object only. Follow the requested draft schema and cite only supplied context_span_id values.",
      },
      { role: "user", content: input },
    ],
    response_format: { type: "json_object" },
    max_tokens: request.provider_config.max_output_tokens,
  };
}

async function parseOutput(response: Response): Promise<unknown> {
  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    throw new ModelGatewayError(
      "INVALID_RESPONSE",
      "The model provider returned invalid JSON.",
    );
  }
  const content = (
    envelope as {
      choices?: Array<{ message?: { content?: unknown } }>;
    }
  ).choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new ModelGatewayError(
      "INVALID_RESPONSE",
      "The model provider response omitted JSON message content.",
    );
  }
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new ModelGatewayError(
      "INVALID_RESPONSE",
      "The model provider message content was not valid JSON.",
    );
  }
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
  if (error instanceof RuntimeSecretError) return "AUTHENTICATION";
  if (error instanceof ModelGatewayError) {
    if (error.code === "INVALID_REQUEST") return "UNKNOWN";
    if (error.code === "PROVIDER_NOT_IMPLEMENTED") return "UNKNOWN";
    if (error.code === "UNKNOWN_CANDIDATE_CONTEXT_SPAN")
      return "INVALID_RESPONSE";
    return error.code;
  }
  return "UNKNOWN";
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
