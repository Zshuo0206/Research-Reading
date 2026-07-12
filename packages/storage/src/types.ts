export type JobKind = "DOCUMENT_IMPORT" | "QUESTION_PLAN" | "ANSWER_GENERATION";
export type JobState = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
export type ReviewStatus = "DRAFT" | "CONFIRMED" | "REJECTED";
export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "INVALID"
  | "INSUFFICIENT_EVIDENCE";

export interface JobRecord<TPayload = unknown, TResult = unknown> {
  jobId: string;
  kind: JobKind;
  state: JobState;
  payload: TPayload;
  result: TResult | null;
  errorMessage: string | null;
  idempotencyKey: string;
  workerId: string | null;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CreateJobInput<TPayload = unknown> {
  jobId: string;
  kind: JobKind;
  payload: TPayload;
  idempotencyKey: string;
  maxAttempts?: number;
  createdAt?: string;
}
