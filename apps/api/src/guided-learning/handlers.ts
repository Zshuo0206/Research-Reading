import type { GuidedLearningProviderConfig } from "../../../../packages/storage/dist/index.js";
import { classifyApiError } from "../api-errors.js";
import type { GuidedLearningRuntime } from "./runtime.js";

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
      const classification = classifyApiError(error);
      return {
        statusCode: classification.statusCode,
        body: {
          schema_version: "api.v1" as const,
          request_id: requestId,
          error: {
            code: classification.code,
            message: classification.message,
            request_id: requestId,
            details: [],
          },
        },
      };
    }
  }
}
