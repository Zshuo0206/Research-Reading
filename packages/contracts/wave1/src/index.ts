import type { Wave1AnswerAndRevisions } from "../generated/answer.v1.d.ts";
import type { Wave1APIEnvelope } from "../generated/api.v1.d.ts";
import type { Wave1ContextAndEvidenceSpans } from "../generated/evidence.v1.d.ts";
import type { Wave1Job } from "../generated/job.v1.d.ts";
import type { Wave1ModelGatewayDiscriminatedBYOKContract } from "../generated/model-gateway.v1.d.ts";
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
export type ModelGatewayEnvelope = Wave1ModelGatewayDiscriminatedBYOKContract;
export type JobState = Wave1Job["state"];
export type Provider =
  Wave1ModelGatewayDiscriminatedBYOKContract["provider_config"]["provider"];
export type GatewayOperation =
  Wave1ModelGatewayDiscriminatedBYOKContract["operation"];
export type ModelProviderConfig =
  Wave1ModelGatewayDiscriminatedBYOKContract["provider_config"];
export type RuntimeSecretRef = NonNullable<
  Wave1ModelGatewayDiscriminatedBYOKContract["runtime_secret_ref"]
>;
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
  Record<Exclude<Provider, "CUSTOM_OPENAI_COMPATIBLE">, string>
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
