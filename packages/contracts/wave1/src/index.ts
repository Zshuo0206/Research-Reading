import type { Wave1AnswerAndRevisions } from "../generated/answer.v1.d.ts";
import type { Wave1APIEnvelope } from "../generated/api.v1.d.ts";
import type { Wave1ContextAndEvidenceSpans } from "../generated/evidence.v1.d.ts";
import type { Wave1Job } from "../generated/job.v1.d.ts";
import type { Wave1ModelGatewayRequestResponseContract } from "../generated/model-gateway.v1.d.ts";
import type { Wave1QuestionPlanAndRevisions } from "../generated/question-plan.v1.d.ts";

export const CONTRACT_VERSIONS = [
  "api.v1",
  "document.v1",
  "job.v1",
  "question-plan.v1",
  "answer.v1",
  "evidence.v1",
  "model-gateway.v1",
] as const;

export type ContractVersion = (typeof CONTRACT_VERSIONS)[number];
export type ApiEnvelope = Wave1APIEnvelope;
export type QuestionPlan = Wave1QuestionPlanAndRevisions;
export type Answer = Wave1AnswerAndRevisions;
export type Job = Wave1Job;
export type ModelGatewayEnvelope = Wave1ModelGatewayRequestResponseContract;
export type ModelGatewayRequest = Extract<
  ModelGatewayEnvelope,
  { message_kind: "REQUEST" }
>;
export type ModelGatewayResponse = Extract<
  ModelGatewayEnvelope,
  { message_kind: "RESPONSE" }
>;
export type JobState = Wave1Job["state"];
export type Provider = ModelGatewayRequest["provider_config"]["provider"];
export type GatewayOperation = ModelGatewayEnvelope["operation"];
export type ModelProviderConfig = ModelGatewayRequest["provider_config"];
export type RuntimeSecretRef = Extract<
  ModelGatewayRequest,
  { runtime_secret_ref: unknown }
>["runtime_secret_ref"];
export type ContextSpan = Extract<
  Wave1ContextAndEvidenceSpans["spans"][number],
  { context_span_id: string }
>;
export type EvidenceSpan = Extract<
  Wave1ContextAndEvidenceSpans["spans"][number],
  { evidence_span_id: string }
>;
export type VerificationStatus = EvidenceSpan["verification_status"];
export type ReviewStatus = QuestionPlan["questions"][number]["review_status"];
export type RevisionBase =
  QuestionPlan["questions"][number]["revisions"][number];
export type Question = QuestionPlan["questions"][number];
export type AnswerRevision = Answer["revisions"][number];
export type AnswerClaim = AnswerRevision["claims"][number];
export type AssertionType =
  | "PAPER_FACT"
  | "AUTHOR_CLAIM"
  | "AGENT_INFERENCE"
  | "INSUFFICIENT_EVIDENCE";

export const PROVIDER_PRESETS: Readonly<
  Record<Exclude<Provider, "CUSTOM_OPENAI_COMPATIBLE" | "MOCK">, string>
> = {
  OPENAI: "https://api.openai.com/v1",
  GEMINI: "https://generativelanguage.googleapis.com/v1beta/openai",
  GROQ: "https://api.groq.com/openai/v1",
  OPENROUTER: "https://openrouter.ai/api/v1",
};

export const JOB_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> =
  {
    QUEUED: ["RUNNING", "CANCEL_REQUESTED"],
    RUNNING: ["SUCCEEDED", "FAILED", "QUEUED", "CANCEL_REQUESTED"],
    SUCCEEDED: [],
    FAILED: ["QUEUED"],
    CANCEL_REQUESTED: ["CANCELLED", "FAILED", "CANCEL_REQUESTED"],
    CANCELLED: [],
  };

export function canTransitionJob(from: JobState, to: JobState): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function isValidEvidenceInterval(
  pageText: string,
  charStart: number,
  charEnd: number,
  quote: string,
): boolean {
  if (
    !Number.isInteger(charStart) ||
    !Number.isInteger(charEnd) ||
    charStart < 0 ||
    charStart >= charEnd
  )
    return false;
  const page = Array.from(pageText);
  return (
    charEnd <= page.length && page.slice(charStart, charEnd).join("") === quote
  );
}

export interface CanonicalPageContext {
  document_version_id: string;
  page_number: number;
  canonical_page_text: string;
  page_text_sha256: string;
  extraction_profile_version: string;
}

function matchesCanonicalPageIdentity(
  span: ContextSpan | EvidenceSpan,
  page: CanonicalPageContext,
): boolean {
  return (
    span.document_version_id === page.document_version_id &&
    span.page_number === page.page_number &&
    span.page_text_sha256 === page.page_text_sha256 &&
    span.extraction_profile_version === page.extraction_profile_version
  );
}

export function validateContextSpan(
  span: ContextSpan,
  page: CanonicalPageContext,
): boolean {
  return (
    matchesCanonicalPageIdentity(span, page) &&
    isValidEvidenceInterval(
      page.canonical_page_text,
      span.char_start,
      span.char_end,
      span.text,
    )
  );
}

export function validateEvidenceSpan(
  span: EvidenceSpan,
  page: CanonicalPageContext,
): boolean {
  return (
    matchesCanonicalPageIdentity(span, page) &&
    isValidEvidenceInterval(
      page.canonical_page_text,
      span.char_start,
      span.char_end,
      span.quote,
    )
  );
}
