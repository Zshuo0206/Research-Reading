export interface SafeApiErrorClassification {
  code: string;
  statusCode: number;
  message: string;
}

const SAFE_ERRORS = new Map<string, SafeApiErrorClassification>([
  [
    "VALIDATION_ERROR",
    safe("VALIDATION_ERROR", 400, "The request is invalid."),
  ],
  [
    "VALIDATION_FAILED",
    safe("VALIDATION_FAILED", 400, "The request is invalid."),
  ],
  ["INVALID_COMMAND", safe("INVALID_COMMAND", 400, "The command is invalid.")],
  [
    "UNSUPPORTED_INPUT",
    safe("UNSUPPORTED_INPUT", 400, "The uploaded content is not supported."),
  ],
  [
    "PDF_LIMIT_EXCEEDED",
    safe(
      "PDF_LIMIT_EXCEEDED",
      400,
      "The PDF exceeds an enforced processing limit.",
    ),
  ],
  [
    "JOB_FAILED",
    safe("JOB_FAILED", 400, "The background operation failed safely."),
  ],
  [
    "RETRY_NOT_ALLOWED",
    safe(
      "RETRY_NOT_ALLOWED",
      409,
      "This operation cannot be retried in the current state.",
    ),
  ],
  [
    "EVIDENCE_NOT_READY",
    safe(
      "EVIDENCE_NOT_READY",
      409,
      "The current question does not have confirmable Evidence.",
    ),
  ],
  [
    "REVISION_CONFLICT",
    safe(
      "REVISION_CONFLICT",
      409,
      "The resource changed; refresh it before retrying.",
    ),
  ],
  [
    "IDEMPOTENCY_CONFLICT",
    safe(
      "IDEMPOTENCY_CONFLICT",
      409,
      "The idempotency key was already used for different input.",
    ),
  ],
  [
    "INVALID_STATE_TRANSITION",
    safe(
      "INVALID_STATE_TRANSITION",
      409,
      "This action is not available in the current state.",
    ),
  ],
  [
    "CONFLICT",
    safe(
      "CONFLICT",
      409,
      "The resource changed or cannot transition from its current state.",
    ),
  ],
  [
    "DOCUMENT_NOT_READY",
    safe(
      "DOCUMENT_NOT_READY",
      409,
      "The document is not ready for this operation.",
    ),
  ],
  ["NOT_FOUND", safe("NOT_FOUND", 404, "Requested resource was not found.")],
]);

const INTERNAL_ERROR = safe(
  "INTERNAL_ERROR",
  500,
  "The server could not complete the request.",
);

export function classifyApiError(error: unknown): SafeApiErrorClassification {
  const code = readErrorCode(error);
  if (code === "INVALID_TRANSITION")
    return SAFE_ERRORS.get("CONFLICT") as SafeApiErrorClassification;
  return SAFE_ERRORS.get(code) ?? INTERNAL_ERROR;
}

function readErrorCode(error: unknown): string {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  )
    return "INTERNAL_ERROR";
  return error.code;
}

function safe(
  code: string,
  statusCode: number,
  message: string,
): SafeApiErrorClassification {
  return Object.freeze({ code, statusCode, message });
}
