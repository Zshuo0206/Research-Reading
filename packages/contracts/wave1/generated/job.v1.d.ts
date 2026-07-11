/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export interface Wave1Job {
schema_version: "job.v1"
job_id: string
kind: ("DOCUMENT_IMPORT" | "QUESTION_PLAN" | "ANSWER_GENERATION")
state: ("QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCEL_REQUESTED" | "CANCELLED")
attempt: number
max_attempts: number
idempotency_key?: string
worker_id?: string
lease_until?: string
next_run_at?: string
failure_class?: ("RETRYABLE" | "NON_RETRYABLE")
created_at: string
started_at?: string
finished_at?: string
}
