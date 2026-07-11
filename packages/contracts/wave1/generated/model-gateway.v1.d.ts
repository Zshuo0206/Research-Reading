/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export type Wave1ModelGatewayDiscriminatedBYOKContract = (({
operation?: "GENERATE_QUESTION_PLAN"
input?: {
document_metadata: {
document_version_id: string
page_count: number
}
document_language: string
method_learning_mode: "METHOD_LEARNING"
/**
 * @minItems 0
 */
context_spans: {
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
}[]
runtime_config_ref: {
kind: "ENVIRONMENT"
name: string
}
}
output?: Wave1QuestionPlanAndRevisions
[k: string]: unknown
} | {
operation?: "GENERATE_ANSWER"
input?: {
confirmed_question_revision: string
/**
 * @minItems 0
 */
context_spans: {
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
}[]
document_metadata: {
document_version_id: string
page_count: number
}
}
output?: {
status: ("SUCCESS" | "INSUFFICIENT_EVIDENCE")
claims: {
claim_id: string
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
candidate_context_span_ids: string[]
}[]
}
[k: string]: unknown
} | {
operation?: "CONNECTION_TEST"
input?: {
probe: true
}
output?: {
success: boolean
provider: string
model: string
error_category?: ("AUTHENTICATION" | "RATE_LIMIT" | "TIMEOUT" | "INVALID_RESPONSE" | "UNAVAILABLE" | "UNKNOWN")
error_message?: string
}
[k: string]: unknown
}) & {
schema_version: "model-gateway.v1"
operation: ("GENERATE_QUESTION_PLAN" | "GENERATE_ANSWER" | "CONNECTION_TEST")
provider_config: {
provider: ("OPENAI" | "GEMINI" | "GROQ" | "OPENROUTER" | "CUSTOM_OPENAI_COMPATIBLE")
base_url: string
model: string
request_timeout_ms: number
max_input_characters: number
max_output_tokens: number
}
runtime_secret_ref?: {
kind: "ENVIRONMENT"
name: string
}
input: unknown
output: unknown
})

export interface Wave1QuestionPlanAndRevisions {
schema_version: "question-plan.v1"
question_plan_id: string
document_version_id: string
document_language: string
/**
 * @minItems 1
 */
retrieval_queries: [string, ...(string)[]]
/**
 * @minItems 1
 */
retrieval_terms: [string, ...(string)[]]
/**
 * @minItems 1
 */
questions: [{
[k: string]: unknown
}, ...({
[k: string]: unknown
})[]]
}
