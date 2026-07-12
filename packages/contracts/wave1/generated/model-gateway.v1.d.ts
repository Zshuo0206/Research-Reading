/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export type Wave1ModelGatewayRequestResponseContract = ({
schema_version: "model-gateway.v1"
message_kind: "REQUEST"
operation: "GENERATE_QUESTION_PLAN"
provider_config: {
provider: ("OPENAI" | "GEMINI" | "GROQ" | "OPENROUTER" | "CUSTOM_OPENAI_COMPATIBLE")
base_url: string
model: string
request_timeout_ms: number
max_input_characters: number
max_output_tokens: number
}
/**
 * Invocation-only reference to a runtime secret. It is never persisted and never contains a plaintext API key.
 */
runtime_secret_ref: ({
kind: "ENVIRONMENT"
name: string
} | {
kind: "SESSION_MEMORY"
handle: string
})
input: {
document_metadata: {
document_version_id: string
page_count: number
}
document_language: string
method_learning_mode: "METHOD_LEARNING"
/**
 * @minItems 1
 */
context_spans: [{
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
}, ...({
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
})[]]
}
} | {
schema_version: "model-gateway.v1"
message_kind: "REQUEST"
operation: "GENERATE_QUESTION_PLAN"
provider_config: {
provider: "MOCK"
fixture_id: string
}
input: {
document_metadata: {
document_version_id: string
page_count: number
}
document_language: string
method_learning_mode: "METHOD_LEARNING"
/**
 * @minItems 1
 */
context_spans: [{
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
}, ...({
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
})[]]
}
} | {
schema_version: "model-gateway.v1"
message_kind: "RESPONSE"
operation: "GENERATE_QUESTION_PLAN"
output: {
document_language: string
/**
 * @minItems 1
 * @maxItems 12
 */
retrieval_queries: [string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string, string, string]
/**
 * @minItems 1
 * @maxItems 30
 */
retrieval_terms: [string, ...(string)[]]
/**
 * @minItems 1
 * @maxItems 12
 */
questions: [{
text: string
}]|[{
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]|[{
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}, {
text: string
}]
}
} | {
schema_version: "model-gateway.v1"
message_kind: "REQUEST"
operation: "GENERATE_ANSWER"
provider_config: {
provider: ("OPENAI" | "GEMINI" | "GROQ" | "OPENROUTER" | "CUSTOM_OPENAI_COMPATIBLE")
base_url: string
model: string
request_timeout_ms: number
max_input_characters: number
max_output_tokens: number
}
/**
 * Invocation-only reference to a runtime secret. It is never persisted and never contains a plaintext API key.
 */
runtime_secret_ref: ({
kind: "ENVIRONMENT"
name: string
} | {
kind: "SESSION_MEMORY"
handle: string
})
input: {
confirmed_question: {
question_id: string
revision_id: string
text: string
}
/**
 * @minItems 1
 */
context_spans: [{
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
}, ...({
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
})[]]
document_metadata: {
document_version_id: string
page_count: number
}
}
} | {
schema_version: "model-gateway.v1"
message_kind: "REQUEST"
operation: "GENERATE_ANSWER"
provider_config: {
provider: "MOCK"
fixture_id: string
}
input: {
confirmed_question: {
question_id: string
revision_id: string
text: string
}
/**
 * @minItems 1
 */
context_spans: [{
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
}, ...({
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
})[]]
document_metadata: {
document_version_id: string
page_count: number
}
}
} | {
schema_version: "model-gateway.v1"
message_kind: "RESPONSE"
operation: "GENERATE_ANSWER"
output: ({
status: "SUCCESS"
/**
 * @minItems 1
 */
claims: [{
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
candidate_context_span_ids: [string, ...(string)[]]
}, ...({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
candidate_context_span_ids: [string, ...(string)[]]
})[]]
} | {
status: "INSUFFICIENT_EVIDENCE"
/**
 * @minItems 1
 * @maxItems 1
 */
claims: [{
text: string
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
candidate_context_span_ids: []
}]
})
} | {
schema_version: "model-gateway.v1"
message_kind: "REQUEST"
operation: "CONNECTION_TEST"
provider_config: {
provider: ("OPENAI" | "GEMINI" | "GROQ" | "OPENROUTER" | "CUSTOM_OPENAI_COMPATIBLE")
base_url: string
model: string
request_timeout_ms: number
max_input_characters: number
max_output_tokens: number
}
/**
 * Invocation-only reference to a runtime secret. It is never persisted and never contains a plaintext API key.
 */
runtime_secret_ref: ({
kind: "ENVIRONMENT"
name: string
} | {
kind: "SESSION_MEMORY"
handle: string
})
input: {
probe: true
}
} | {
schema_version: "model-gateway.v1"
message_kind: "REQUEST"
operation: "CONNECTION_TEST"
provider_config: {
provider: "MOCK"
fixture_id: string
}
input: {
probe: true
}
} | {
schema_version: "model-gateway.v1"
message_kind: "RESPONSE"
operation: "CONNECTION_TEST"
output: ({
success: true
provider: ("OPENAI" | "GEMINI" | "GROQ" | "OPENROUTER" | "CUSTOM_OPENAI_COMPATIBLE" | "MOCK")
model: string
} | {
success: false
provider: ("OPENAI" | "GEMINI" | "GROQ" | "OPENROUTER" | "CUSTOM_OPENAI_COMPATIBLE" | "MOCK")
model: string
error_category: ("AUTHENTICATION" | "RATE_LIMIT" | "TIMEOUT" | "INVALID_RESPONSE" | "UNAVAILABLE" | "UNKNOWN")
error_message?: string
})
})
