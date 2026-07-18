import type { GuidedLearningProviderConfig } from "../../../../packages/storage/dist/index.js";
import type { GuidedLearningRuntime } from "./runtime.js";
import { GuidedLearningRuntimeError } from "./runtime.js";

export class GuidedLearningApiHandlers {
  constructor(private readonly runtime: GuidedLearningRuntime) {}

  create(input: {
    project_id: string;
    document_version_id: string;
    learning_goal: string;
    provider_config?: GuidedLearningProviderConfig;
  }) {
    return this.runtime.requestDirectionsGeneration(input);
  }

  get(sessionId: string) {
    return this.runtime.getSession(sessionId);
  }

  command(
    sessionId: string,
    input: {
      contract_version: string;
      event: string;
      payload: unknown;
      idempotency_key: string;
    },
  ) {
    return this.runtime.executeCommand({ session_id: sessionId, ...input });
  }

  async handle(requestId: string, operation: () => unknown | Promise<unknown>) {
    try {
      return {
        statusCode: 200,
        body: {
          schema_version: "api.v1" as const,
          request_id: requestId,
          data: await operation(),
        },
      };
    } catch (error) {
      const code =
        error instanceof GuidedLearningRuntimeError
          ? error.code
          : "INTERNAL_ERROR";
      const statusCode =
        code === "NOT_FOUND"
          ? 404
          : code === "INTERNAL_ERROR"
            ? 500
            : code === "REVISION_CONFLICT" ||
                code === "IDEMPOTENCY_CONFLICT" ||
                code === "INVALID_STATE_TRANSITION"
              ? 409
              : 400;
      return {
        statusCode,
        body: {
          schema_version: "api.v1" as const,
          request_id: requestId,
          error: {
            code,
            message: safeGuidedLearningMessage(code),
            request_id: requestId,
            details: [],
          },
        },
      };
    }
  }
}

function safeGuidedLearningMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "The guided learning session was not found.";
    case "REVISION_CONFLICT":
      return "The session changed; refresh it before retrying.";
    case "IDEMPOTENCY_CONFLICT":
      return "The idempotency key was already used for different input.";
    case "INVALID_STATE_TRANSITION":
      return "This action is not available in the current session state.";
    case "VALIDATION_FAILED":
      return "The guided learning request is invalid.";
    default:
      return "The server could not complete the guided learning request.";
  }
}
