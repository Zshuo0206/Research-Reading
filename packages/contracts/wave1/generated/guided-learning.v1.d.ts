/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export type Wave1GuidedLearningSessionAndStateMachine = ({
schema_version: "guided-learning.v1"
message_kind: ("SESSION" | "COMMAND")
[k: string]: unknown
} & ({
schema_version: "guided-learning.v1"
message_kind: "SESSION"
session: ({
session_id: string
project_id: string
document_version_id: string
mode: "GUIDED_LEARNING"
learning_goal: string
state: ("CREATED" | "AWAITING_DIRECTION_SELECTION" | "ROUTE_LOCKED" | "QUESTIONS_GENERATING" | "AWAITING_ANSWER" | "ANSWER_SUBMITTED" | "FEEDBACK_READY" | "QUESTION_COMPLETED" | "SUMMARY_GENERATING" | "STAGE_COMPLETED" | "SESSION_COMPLETED" | "RETRYABLE_FAILURE" | "FAILED")
session_revision: number
state_version: number
/**
 * @minItems 0
 * @maxItems 3
 */
candidate_directions: []|[{
direction_id: string
title: string
description: string
selection_basis: string
}]|[{
direction_id: string
title: string
description: string
selection_basis: string
}, {
direction_id: string
title: string
description: string
selection_basis: string
}]|[{
direction_id: string
title: string
description: string
selection_basis: string
}, {
direction_id: string
title: string
description: string
selection_basis: string
}, {
direction_id: string
title: string
description: string
selection_basis: string
}]
selected_direction_id?: string
route?: {
route_id: string
route_version: "guided-route.v1"
locked: true
locked_at: string
/**
 * @minItems 3
 * @maxItems 3
 */
stages: [{
stage_id: ("UNDERSTAND" | "ANALYZE" | "TRANSFER")
order: number
title: string
status: ("LOCKED" | "OPEN" | "COMPLETED")
unlock_condition: ("SESSION_DIRECTION_SELECTED" | "PREVIOUS_STAGE_COMPLETED" | "NOT_AVAILABLE_IN_V1")
}, {
stage_id: ("UNDERSTAND" | "ANALYZE" | "TRANSFER")
order: number
title: string
status: ("LOCKED" | "OPEN" | "COMPLETED")
unlock_condition: ("SESSION_DIRECTION_SELECTED" | "PREVIOUS_STAGE_COMPLETED" | "NOT_AVAILABLE_IN_V1")
}, {
stage_id: ("UNDERSTAND" | "ANALYZE" | "TRANSFER")
order: number
title: string
status: ("LOCKED" | "OPEN" | "COMPLETED")
unlock_condition: ("SESSION_DIRECTION_SELECTED" | "PREVIOUS_STAGE_COMPLETED" | "NOT_AVAILABLE_IN_V1")
}]
}
current_stage_id?: ("UNDERSTAND" | "ANALYZE" | "TRANSFER")
current_question_order?: number
/**
 * @minItems 3
 * @maxItems 7
 */
questions?: [({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
}))]|[({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
}))]|[({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
}))]|[({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
}))]|[({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
})), ({
question_id: string
order: number
stage_id: "UNDERSTAND"
prompt: string
status: ("UNSEEN" | "ACTIVE" | "ANSWERED" | "SKIPPED" | "FEEDBACK_READY" | "CONFIRMED")
confirmation_status: ("PENDING" | "CONFIRMED" | "SKIPPED")
user_answer?: string
skip_reason?: "I_DONT_KNOW"
feedback?: {
summary: string
/**
 * @maxItems 10
 */
omissions: []|[string]|[string, string]|[string, string, string]|[string, string, string, string]|[string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string]|[string, string, string, string, string, string, string, string, string, string]
}
reference_answer?: {
text: string
/**
 * @minItems 1
 */
claims: [({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})), ...(({
text: string
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE" | "INSUFFICIENT_EVIDENCE")
evidence_refs: string[]
} & ({
claim_type: "INSUFFICIENT_EVIDENCE"
/**
 * @maxItems 0
 */
evidence_refs: []
[k: string]: unknown
} | {
claim_type: ("PAPER_FACT" | "AUTHOR_CLAIM" | "AGENT_INFERENCE")
/**
 * @minItems 1
 */
evidence_refs: [unknown, ...(unknown)[]]
[k: string]: unknown
})))[]]
}
/**
 * @minItems 1
 */
evidence?: [{
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}, ...({
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]]
} & ({
status: ("UNSEEN" | "ACTIVE")
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "ANSWERED"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "SKIPPED"
confirmation_status: "SKIPPED"
skip_reason: "I_DONT_KNOW"
[k: string]: unknown
} | {
status: "FEEDBACK_READY"
confirmation_status: "PENDING"
[k: string]: unknown
} | {
status: "CONFIRMED"
confirmation_status: "CONFIRMED"
[k: string]: unknown
}))]
stage_summary?: {
stage_id: "UNDERSTAND"
status: "GENERATED"
completed_question_orders: number[]
skipped_question_orders: number[]
key_mastery_points: string[]
major_weak_points: string[]
next_stage_hint: string
}
failure?: ({
failed_operation?: "GENERATE_DIRECTIONS"
resume_state?: "CREATED"
[k: string]: unknown
} | {
failed_operation?: "GENERATE_QUESTIONS"
resume_state?: ("ROUTE_LOCKED" | "QUESTIONS_GENERATING")
[k: string]: unknown
} | {
failed_operation?: "GENERATE_FEEDBACK"
resume_state?: "ANSWER_SUBMITTED"
[k: string]: unknown
} | {
failed_operation?: "GENERATE_STAGE_SUMMARY"
resume_state?: ("QUESTION_COMPLETED" | "SUMMARY_GENERATING")
[k: string]: unknown
})
created_at: string
updated_at: string
} & ({
state: "CREATED"
/**
 * @maxItems 0
 */
candidate_directions?: []
[k: string]: unknown
} | {
state: "AWAITING_DIRECTION_SELECTION"
/**
 * @minItems 2
 * @maxItems 3
 */
candidate_directions: [unknown, unknown]|[unknown, unknown, unknown]
[k: string]: unknown
} | {
state: "ROUTE_LOCKED"
current_stage_id: "UNDERSTAND"
[k: string]: unknown
} | {
state: "QUESTIONS_GENERATING"
current_stage_id: "UNDERSTAND"
[k: string]: unknown
} | {
state: ("AWAITING_ANSWER" | "ANSWER_SUBMITTED" | "FEEDBACK_READY" | "QUESTION_COMPLETED")
current_stage_id: "UNDERSTAND"
[k: string]: unknown
} | {
state: "SUMMARY_GENERATING"
current_stage_id: "UNDERSTAND"
[k: string]: unknown
} | {
state: "STAGE_COMPLETED"
current_stage_id: "UNDERSTAND"
[k: string]: unknown
} | {
state: "SESSION_COMPLETED"
current_stage_id: "UNDERSTAND"
[k: string]: unknown
} | ({
state?: "RETRYABLE_FAILURE"
failure?: {
failure_class?: "RETRYABLE"
[k: string]: unknown
}
[k: string]: unknown
} | {
state?: "FAILED"
failure?: {
failure_class?: "PERMANENT"
[k: string]: unknown
}
[k: string]: unknown
})))
} | ({
schema_version: "guided-learning.v1"
message_kind: "COMMAND"
command_id: string
request_id: string
idempotency_key: string
session_id: string
command: ("SELECT_DIRECTION" | "START_STAGE" | "SUBMIT_ANSWER" | "SKIP_QUESTION" | "CONFIRM_QUESTION" | "EDIT_ANSWER" | "ADVANCE_QUESTION" | "RETRY")
payload: {
[k: string]: unknown
}
} & ({
command: "SELECT_DIRECTION"
payload: {
direction_id: string
}
[k: string]: unknown
} | {
command: "START_STAGE"
payload: {
stage_id: "UNDERSTAND"
}
[k: string]: unknown
} | {
command: "SUBMIT_ANSWER"
payload: {
question_id: string
question_order: number
answer: string
}
[k: string]: unknown
} | {
command: "SKIP_QUESTION"
payload: {
question_id: string
question_order: number
reason: "I_DONT_KNOW"
}
[k: string]: unknown
} | {
command: "CONFIRM_QUESTION"
payload: {
question_id: string
question_order: number
}
[k: string]: unknown
} | {
command: "EDIT_ANSWER"
payload: {
question_id: string
question_order: number
answer: string
}
[k: string]: unknown
} | {
command: "ADVANCE_QUESTION"
payload: {
question_id: string
question_order: number
}
[k: string]: unknown
} | {
command: "RETRY"
payload: {

}
[k: string]: unknown
}))))
