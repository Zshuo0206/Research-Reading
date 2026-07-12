/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export interface Wave1QuestionPlanAndRevisions {
schema_version: "question-plan.v1"
question_plan_id: string
document_version_id: string
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]|[{
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}, {
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
text: string
}, ...({
revision_id: string
revision_number: number
created_by: ("MODEL" | "LOCAL_OPERATOR")
created_at: string
content_hash: string
supersedes_revision_id?: string
text: string
})[]]
review_status: ("DRAFT" | "CONFIRMED" | "REJECTED")
verification_status: "NOT_REQUIRED"
}]
}
