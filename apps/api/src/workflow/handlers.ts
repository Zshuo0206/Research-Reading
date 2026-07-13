import type { WorkflowService } from "./service.js";

export interface ApiResult {
  statusCode: number;
  body:
    | { schema_version: "api.v1"; request_id: string; data: unknown }
    | {
        schema_version: "api.v1";
        request_id: string;
        error: {
          code: string;
          message: string;
          request_id: string;
          details: unknown[];
        };
      };
}

export class WorkflowApiHandlers {
  constructor(private readonly service: WorkflowService) {}

  async handle(
    requestId: string,
    operation: (service: WorkflowService) => unknown | Promise<unknown>,
  ): Promise<ApiResult> {
    try {
      const data = await operation(this.service);
      return {
        statusCode: 200,
        body: { schema_version: "api.v1", request_id: requestId, data },
      };
    } catch (error) {
      const code = errorCode(error);
      return {
        statusCode:
          code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : 400,
        body: {
          schema_version: "api.v1",
          request_id: requestId,
          error: {
            code,
            message: safeMessage(error),
            request_id: requestId,
            details: [],
          },
        },
      };
    }
  }
}

function errorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error.code === "INVALID_TRANSITION" ? "CONFLICT" : error.code;
  return "VALIDATION_ERROR";
}

function safeMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Invalid workflow request";
}
