/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export interface Wave1UnifiedErrorObject {
code: ("VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "DEPENDENCY_UNAVAILABLE" | "TIMEOUT" | "INTERNAL_ERROR" | "INVALID_STATE_TRANSITION" | "INVALID_EVIDENCE" | "INSUFFICIENT_EVIDENCE" | "BUDGET_EXCEEDED" | "SECRET_REQUIRED" | "UNSUPPORTED_PROVIDER" | "INVALID_BASE_URL")
message: string
retryable: boolean
details?: {
[k: string]: unknown
}[]
provider?: string
}
