import { classifyApiError } from "../api-errors.js";
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
      const classification = classifyApiError(error);
      return {
        statusCode: classification.statusCode,
        body: {
          schema_version: "api.v1",
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
