/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export interface Wave1AnswerAndRevisions {
schema_version: "answer.v1"
answer_id: string
question_id: string
current_revision: string
/**
 * @minItems 1
 */
revisions: [{
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
/**
 * @minItems 1
 */
claims: [({
[k: string]: unknown
} & {
[k: string]: unknown
}), ...(({
[k: string]: unknown
} & {
[k: string]: unknown
}))[]]
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
/**
 * @minItems 1
 */
claims: [({
[k: string]: unknown
} & {
[k: string]: unknown
}), ...(({
[k: string]: unknown
} & {
[k: string]: unknown
}))[]]
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
}
