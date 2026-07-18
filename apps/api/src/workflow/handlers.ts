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
          code === "INTERNAL_ERROR"
            ? 500
            : code === "NOT_FOUND"
              ? 404
              : code === "CONFLICT" || code === "DOCUMENT_NOT_READY"
                ? 409
                : 400,
        body: {
          schema_version: "api.v1",
          request_id: requestId,
          error: {
            code,
            message: safeMessage(code),
            request_id: requestId,
            details: [],
          },
        },
      };
    }
  }
}

function errorCode(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "INTERNAL_ERROR";
  if (code === "INVALID_TRANSITION") return "CONFLICT";
  return SAFE_CODES.has(code) ? code : "INTERNAL_ERROR";
}

const SAFE_CODES = new Set([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "DOCUMENT_NOT_READY",
  "UNSUPPORTED_INPUT",
  "PDF_LIMIT_EXCEEDED",
  "JOB_FAILED",
]);

function safeMessage(code: string): string {
  switch (code) {
    case "NOT_FOUND":
      return "Requested resource was not found.";
    case "CONFLICT":
      return "The resource changed or cannot transition from its current state.";
    case "DOCUMENT_NOT_READY":
      return "The document is not ready for this operation.";
    case "UNSUPPORTED_INPUT":
      return "The uploaded content is not supported.";
    case "PDF_LIMIT_EXCEEDED":
      return "The PDF exceeds an enforced processing limit.";
    case "JOB_FAILED":
      return "The background operation failed safely.";
    case "VALIDATION_ERROR":
      return "The request is invalid.";
    default:
      return "The server could not complete the request.";
  }
}
