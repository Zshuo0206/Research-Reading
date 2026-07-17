import { createHash } from "node:crypto";
import {
  applyGuidedLearningEvent,
  validateGuidedLearningSessionConsistency,
} from "../../../../packages/contracts/dist/wave1/src/index.js";
import type {
  GuidedLearningFailure,
  GuidedLearningSession,
} from "../../../../packages/contracts/dist/wave1/src/index.js";
import type {
  DocumentPageRecord,
  GuidedLearningGenerationJobPayload,
  GuidedLearningJobKind,
  GuidedLearningSessionRepository,
  StorageRepository,
} from "../../../../packages/storage/dist/index.js";
import type { JobHandler } from "../runtime/job-runtime.js";

type Value = Record<string, unknown>;

export type GuidedLearningEvidenceResolutionReason =
  | "MODEL_INSUFFICIENT_EVIDENCE"
  | "CONTEXT_SPAN_ID_MISSING"
  | "CONTEXT_SPAN_NOT_FOUND"
  | "DOCUMENT_VERSION_MISMATCH"
  | "QUOTE_MISSING"
  | "QUOTE_TOO_SHORT"
  | "QUOTE_TOO_LONG"
  | "QUOTE_NOT_FOUND"
  | "QUOTE_NOT_UNIQUE"
  | "VERIFIED";

export type GuidedLearningEvidenceResolutionOutcome =
  | "VERIFIED"
  | "INSUFFICIENT_EVIDENCE";

export type GuidedLearningEvidenceExactMatchCountBucket =
  | "NOT_CHECKED"
  | "ZERO"
  | "ONE"
  | "MULTIPLE";

export interface GuidedLearningEvidenceResolutionEvent {
  event: "guided_feedback_evidence_resolution";
  operation: "GUIDED_LEARNING_FEEDBACK_GENERATION";
  claim_index: number;
  model_claim_type: string;
  resolution_outcome: GuidedLearningEvidenceResolutionOutcome;
  resolution_reason: GuidedLearningEvidenceResolutionReason;
  context_span_id_present?: boolean;
  context_span_found?: boolean;
  document_version_matches?: boolean;
  quote_present?: boolean;
  quote_codepoint_length?: number;
  exact_match_count_bucket: GuidedLearningEvidenceExactMatchCountBucket;
  page_number?: number;
}

export interface GuidedLearningEvidenceResolutionLogger {
  log(event: GuidedLearningEvidenceResolutionEvent): void;
}

type GuidedLearningEvidenceResolutionMetadata = Omit<
  GuidedLearningEvidenceResolutionEvent,
  "event" | "operation" | "claim_index"
>;

export interface GuidedLearningClaimResolution {
  text: string;
  claim_type: string;
  evidence?: Value;
  diagnostic: GuidedLearningEvidenceResolutionMetadata;
}

const NOOP_EVIDENCE_RESOLUTION_LOGGER: GuidedLearningEvidenceResolutionLogger = {
  log: () => undefined,
};

export interface GuidedLearningWorkerModelGateway {
  invoke(request: unknown): Promise<unknown>;
}

export function createGuidedLearningJobHandlers(input: {
  repository: GuidedLearningSessionRepository;
  storage: StorageRepository;
  gateway: GuidedLearningWorkerModelGateway;
  now?: () => string;
  evidenceResolutionLogger?: GuidedLearningEvidenceResolutionLogger;
}): Partial<Record<GuidedLearningJobKind, JobHandler>> {
  const now = input.now ?? (() => new Date().toISOString());
  const evidenceResolutionLogger = input.evidenceResolutionLogger ?? NOOP_EVIDENCE_RESOLUTION_LOGGER;
  const handler = (operation: GuidedLearningJobKind): JobHandler =>
    async (rawPayload) => {
      const payload = parsePayload(rawPayload, operation);
      try {
        return await runGeneration({ ...input, evidenceResolutionLogger }, payload, now);
      } catch (error) {
        await recordFailureIfCurrent(input.repository, payload, error, now);
        throw error;
      }
    };
  return {
    GUIDED_LEARNING_DIRECTION_GENERATION: handler("GUIDED_LEARNING_DIRECTION_GENERATION"),
    GUIDED_LEARNING_QUESTION_GENERATION: handler("GUIDED_LEARNING_QUESTION_GENERATION"),
    GUIDED_LEARNING_FEEDBACK_GENERATION: handler("GUIDED_LEARNING_FEEDBACK_GENERATION"),
    GUIDED_LEARNING_STAGE_SUMMARY_GENERATION: handler("GUIDED_LEARNING_STAGE_SUMMARY_GENERATION"),
  };
}

async function runGeneration(
  input: {
    repository: GuidedLearningSessionRepository;
    storage: StorageRepository;
    gateway: GuidedLearningWorkerModelGateway;
    evidenceResolutionLogger: GuidedLearningEvidenceResolutionLogger;
  },
  payload: GuidedLearningGenerationJobPayload,
  now: () => string,
): Promise<unknown> {
  const session = input.repository.get(payload.session_id);
  if (!session) throw new GuidedLearningWorkerError("NOT_FOUND", "Session not found");
  const completedState = completedStateFor(payload.operation);
  if (session.session_revision > payload.expected_revision && session.state === completedState)
    return { idempotent: true, session };
  if (session.session_revision !== payload.expected_revision || session.state !== payload.expected_state)
    throw new GuidedLearningWorkerError("REVISION_CONFLICT", `Session ${payload.session_id} no longer matches the generation boundary`);
  if (payload.operation === "GUIDED_LEARNING_FEEDBACK_GENERATION")
    requireFeedbackPointer(payload, session);
  const pages = input.storage.getDocumentPages(payload.document_version_id);
  if (pages.length === 0) throw new GuidedLearningWorkerError("NOT_FOUND", "Document version has no canonical pages");
  const contexts = contextSpans(payload.document_version_id, pages);
  let next: GuidedLearningSession;
  const isMock = payload.provider_config.provider === "MOCK";
  switch (payload.operation) {
    case "GUIDED_LEARNING_DIRECTION_GENERATION":
      if (isMock) await invokeQuestionPlan(input.gateway, payload, contexts);
      next = isMock
        ? withDirections(session)
        : withModelDirections(
            session,
            await invokeGuided(input.gateway, "GENERATE_GUIDED_DIRECTIONS", payload, contexts, session),
          );
      break;
    case "GUIDED_LEARNING_QUESTION_GENERATION":
      next = isMock
        ? withQuestions(session, await invokeQuestionPlan(input.gateway, payload, contexts))
        : withModelQuestions(
            session,
            await invokeGuided(input.gateway, "GENERATE_GUIDED_QUESTIONS", payload, contexts, session),
          );
      break;
    case "GUIDED_LEARNING_FEEDBACK_GENERATION":
      next = isMock
        ? withFeedback(session, payload, await invokeAnswer(input.gateway, payload, contexts, currentQuestion(session)), contexts)
        : withModelFeedback(
            session,
            payload,
            await invokeGuided(input.gateway, "GENERATE_GUIDED_FEEDBACK", payload, contexts, session),
            contexts,
            input.evidenceResolutionLogger,
          );
      break;
    case "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION":
      next = isMock
        ? withSummary(session)
        : withModelSummary(
            session,
            await invokeGuided(input.gateway, "GENERATE_GUIDED_STAGE_SUMMARY", payload, contexts, session),
          );
      break;
  }
  next.session_revision = session.session_revision + 1;
  next.state_version = session.state_version + 1;
  next.updated_at = now();
  assertConsistent(next);
  input.repository.save(next, payload.expected_revision);
  return { idempotent: false, session: next };
}

function withDirections(session: GuidedLearningSession): GuidedLearningSession {
  return transition(session, "DIRECTIONS_READY", (next) => {
    next.candidate_directions = [
      { direction_id: "direction_method", title: "理解方法设计", description: "梳理论文方法的整体框架和关键模块。", selection_basis: "与学习目标最直接相关。" },
      { direction_id: "direction_evidence", title: "理解证据链", description: "理解研究方法如何支持论文的主要结论。", selection_basis: "帮助把方法主张和论文证据对应起来。" },
    ];
  });
}

function withModelDirections(session: GuidedLearningSession, output: Value): GuidedLearningSession {
  const directions = Array.isArray(output.directions) ? output.directions : [];
  if (directions.length < 2 || directions.length > 3)
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model directions must contain 2 to 3 items");
  return transition(session, "DIRECTIONS_READY", (next) => {
    next.candidate_directions = directions.map((item, index) => {
      if (!isRecord(item) || typeof item.title !== "string" || typeof item.description !== "string" || typeof item.selection_basis !== "string")
        throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model direction output is malformed");
      return {
        direction_id: `direction_${session.session_id}_${index + 1}`,
        title: item.title,
        description: item.description,
        selection_basis: item.selection_basis,
      };
    });
  });
}

function withQuestions(session: GuidedLearningSession, plan: Value): GuidedLearningSession {
  const plannedQuestions = Array.isArray(plan.questions) ? plan.questions : [];
  const firstPrompt = isRecord(plannedQuestions[0]) && typeof plannedQuestions[0].text === "string" ? plannedQuestions[0].text : `请说明学习目标“${session.learning_goal}”对应的方法核心环节及其作用。`;
  return transition(session, "QUESTIONS_READY", (next) => {
    next.questions = [firstPrompt, "论文中的证据如何支持这一方法环节？", "这一方法环节对研究结论有什么影响？"].map((prompt, index) => ({
      question_id: `question_${session.session_id}_${index + 1}`,
      order: index + 1,
      stage_id: "UNDERSTAND",
      prompt,
      status: index === 0 ? "ACTIVE" : "UNSEEN",
      confirmation_status: "PENDING",
    }));
    next.current_stage_id = "UNDERSTAND";
    next.current_question_order = 1;
  });
}

function withModelQuestions(session: GuidedLearningSession, output: Value): GuidedLearningSession {
  const questions = Array.isArray(output.questions) ? output.questions : [];
  if (questions.length < 3 || questions.length > 7)
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model questions must contain 3 to 7 items");
  return transition(session, "QUESTIONS_READY", (next) => {
    next.questions = questions.map((item, index) => {
      if (!isRecord(item) || typeof item.text !== "string" || !item.text.trim())
        throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model question output is malformed");
      return {
        question_id: `question_${session.session_id}_${index + 1}`,
        order: index + 1,
        stage_id: "UNDERSTAND",
        prompt: item.text,
        status: index === 0 ? "ACTIVE" : "UNSEEN",
        confirmation_status: "PENDING",
      };
    });
    next.current_stage_id = "UNDERSTAND";
    next.current_question_order = 1;
  });
}

function withFeedback(session: GuidedLearningSession, payload: GuidedLearningGenerationJobPayload, answer: Value, contexts: Value[]): GuidedLearningSession {
  const question = currentQuestion(session);
  const selected = contexts[0];
  if (!selected) throw new GuidedLearningWorkerError("EVIDENCE_NOT_READY", "No canonical context is available for Evidence");
  const evidenceId = `evidence_${session.session_id}_${question.question_id}`;
  const quote = takeCodePoints(String(selected.text), 0, 40);
  if (!quote) throw new GuidedLearningWorkerError("EVIDENCE_NOT_READY", "Canonical page text is empty");
  const evidence = {
    evidence_span_id: evidenceId,
    context_span_id: String(selected.context_span_id),
    document_version_id: payload.document_version_id,
    page_number: Number(selected.page_number),
    page_text_sha256: String(selected.page_text_sha256),
    extraction_profile_version: String(selected.extraction_profile_version),
    char_start: 0,
    char_end: Array.from(quote).length,
    quote,
    verification_status: "VERIFIED",
  };
  const claims = Array.isArray(answer.claims) ? answer.claims.map((claim) => ({
    text: String(claim.text ?? "").slice(0, 500),
    claim_type: claim.claim_type === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : "PAPER_FACT",
    evidence_refs: claim.claim_type === "INSUFFICIENT_EVIDENCE" ? [] : [evidenceId],
  })) : [];
  const safeClaims = claims.length ? claims : [{ text: "论文内容支持该方法环节。", claim_type: "PAPER_FACT", evidence_refs: [evidenceId] }];
  return transition(session, "FEEDBACK_READY", (next) => {
    const current = currentQuestion(next as unknown as GuidedLearningSession);
    current.status = "FEEDBACK_READY";
    current.feedback = { summary: "回答已由 Worker 结合论文原文生成点评。", omissions: [] };
    current.reference_answer = { text: safeClaims.map((claim) => claim.text).join(" "), claims: safeClaims };
    current.evidence = [evidence];
  });
}

function withModelFeedback(
  session: GuidedLearningSession,
  payload: GuidedLearningGenerationJobPayload,
  output: Value,
  contexts: Value[],
  evidenceResolutionLogger: GuidedLearningEvidenceResolutionLogger,
): GuidedLearningSession {
  const current = currentQuestion(session);
  const rawClaims = Array.isArray(output.claims) ? output.claims : [];
  if (!rawClaims.length) throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model feedback has no claims");
  if (output.status !== "SUCCESS" && output.status !== "INSUFFICIENT_EVIDENCE")
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model feedback status is invalid", false);
  const resolved = rawClaims.map((claim, claimIndex) => {
    const result = resolveClaim(claim, contexts, payload.document_version_id);
    safeLogEvidenceResolution(evidenceResolutionLogger, {
      event: "guided_feedback_evidence_resolution",
      operation: "GUIDED_LEARNING_FEEDBACK_GENERATION",
      claim_index: claimIndex,
      ...result.diagnostic,
    });
    return result;
  });
  const evidenceByKey = new Map<string, Value>();
  for (const item of resolved) {
    if (item.evidence) {
      const key = `${item.evidence.context_span_id}:${item.evidence.char_start}:${item.evidence.char_end}:${item.evidence.quote}`;
      evidenceByKey.set(key, item.evidence);
    }
  }
  const evidence = [...evidenceByKey.values()];
  const evidenceIdByKey = new Map(
    [...evidenceByKey.entries()].map(([key, value]) => [key, String(value.evidence_span_id)]),
  );
  const claims = resolved.map((item) => ({
    text: item.text,
    claim_type: item.claim_type,
    evidence_refs: item.evidence
      ? [evidenceIdByKey.get(`${item.evidence.context_span_id}:${item.evidence.char_start}:${item.evidence.char_end}:${item.evidence.quote}`) as string]
      : [],
  }));
  if (output.status === "INSUFFICIENT_EVIDENCE" && claims.some((claim) => claim.claim_type !== "INSUFFICIENT_EVIDENCE"))
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "INSUFFICIENT_EVIDENCE feedback cannot contain supported claims", false);
  const safeClaims = claims.length ? claims : [{ text: "当前上下文不足以确认答案。", claim_type: "INSUFFICIENT_EVIDENCE", evidence_refs: [] }];
  const omissions = Array.isArray(output.omissions)
    ? output.omissions.filter((entry: unknown): entry is string => typeof entry === "string").slice(0, 20)
    : undefined;
  if (typeof output.summary !== "string" || typeof output.reference_answer !== "string" || !omissions)
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model feedback output is malformed", false);
  return transition(session, "FEEDBACK_READY", (next) => {
    const question = currentQuestion(next as unknown as GuidedLearningSession);
    question.status = "FEEDBACK_READY";
    question.feedback = { summary: output.summary, omissions };
    question.reference_answer = { text: output.reference_answer, claims: safeClaims };
    question.evidence = evidence;
    if (current.question_id !== question.question_id || payload.question_id !== question.question_id)
      throw new GuidedLearningWorkerError("REVISION_CONFLICT", "Feedback question pointer changed");
  });
}

function withModelSummary(session: GuidedLearningSession, output: Value): GuidedLearningSession {
  const cleanList = (value: unknown, required: boolean): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const result = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, 1000))
      .filter(Boolean)
      .slice(0, 20);
    return required && result.length === 0 ? undefined : result;
  };
  const points = cleanList(output.key_mastery_points, true);
  const weakPoints = cleanList(output.major_weak_points, false);
  const nextStageHintValue: unknown = output.next_stage_hint;
  const nextStageHint = typeof nextStageHintValue === "string" ? nextStageHintValue.trim().slice(0, 2000) : undefined;
  if (!points || !weakPoints || !nextStageHint)
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model summary output is malformed");
  return transition(session, "SUMMARY_READY", (next) => {
    const questions = (next.questions as unknown as GuidedLearningSession["questions"] | undefined) ?? [];
    next.stage_summary = {
      stage_id: "UNDERSTAND", status: "GENERATED",
      completed_question_orders: questions.filter((question) => question.status === "CONFIRMED").map((question) => question.order),
      skipped_question_orders: questions.filter((question) => question.status === "SKIPPED").map((question) => question.order),
      key_mastery_points: points,
      major_weak_points: weakPoints,
      next_stage_hint: nextStageHint,
    };
    const route = next.route as { stages?: Value[] } | undefined;
    if (route?.stages?.[0]) route.stages[0].status = "COMPLETED";
  });
}

function withSummary(session: GuidedLearningSession): GuidedLearningSession {
  return transition(session, "SUMMARY_READY", (next) => {
    const questions = (next.questions as GuidedLearningSession["questions"] | undefined) ?? [];
    const completed = questions.filter((question) => question.status === "CONFIRMED").map((question) => question.order);
    const skipped = questions.filter((question) => question.status === "SKIPPED").map((question) => question.order);
    next.stage_summary = {
      stage_id: "UNDERSTAND", status: "GENERATED", completed_question_orders: completed, skipped_question_orders: skipped,
      key_mastery_points: ["能够根据论文原文说明方法流程"], major_weak_points: skipped.length ? ["部分问题尚未形成回答"] : [],
      next_stage_hint: "V1.0 暂不开放 ANALYZE 和 TRANSFER 阶段.",
    };
    const route = next.route as { stages?: Value[] } | undefined;
    if (route?.stages?.[0]) route.stages[0].status = "COMPLETED";
  });
}

function transition(session: GuidedLearningSession, event: "DIRECTIONS_READY" | "QUESTIONS_READY" | "FEEDBACK_READY" | "SUMMARY_READY", mutate: (next: Value) => void): GuidedLearningSession {
  const next = structuredClone(session) as unknown as Value;
  const result = applyGuidedLearningEvent({ state: session.state, event });
  if (result.outcome === "REJECTED") throw new GuidedLearningWorkerError("INVALID_STATE_TRANSITION", `Cannot apply ${event} from ${session.state}`);
  next.state = result.to_state;
  mutate(next);
  return next as unknown as GuidedLearningSession;
}

async function invokeQuestionPlan(gateway: GuidedLearningWorkerModelGateway, payload: GuidedLearningGenerationJobPayload, contexts: Value[]): Promise<Value> {
  const response = await invokeGateway(gateway, {
    schema_version: "model-gateway.v1", message_kind: "REQUEST", operation: "GENERATE_QUESTION_PLAN", provider_config: payload.provider_config,
    input: { document_metadata: { document_version_id: payload.document_version_id, page_count: contexts.length }, document_language: "zh-CN", method_learning_mode: "METHOD_LEARNING", context_spans: contexts },
  });
  return extractOutput(response, "GENERATE_QUESTION_PLAN");
}

async function invokeGuided(
  gateway: GuidedLearningWorkerModelGateway,
  operation: "GENERATE_GUIDED_DIRECTIONS" | "GENERATE_GUIDED_QUESTIONS" | "GENERATE_GUIDED_FEEDBACK" | "GENERATE_GUIDED_STAGE_SUMMARY",
  payload: GuidedLearningGenerationJobPayload,
  contexts: Value[],
  session: GuidedLearningSession,
): Promise<Value> {
  const documentMetadata = {
    document_version_id: payload.document_version_id,
    page_count: contexts.length,
  };
  let sessionInput: Value;
  switch (operation) {
    case "GENERATE_GUIDED_DIRECTIONS":
      sessionInput = buildDirectionsInput(payload, contexts, documentMetadata);
      break;
    case "GENERATE_GUIDED_QUESTIONS":
      sessionInput = buildQuestionsInput(session, payload, contexts, documentMetadata);
      break;
    case "GENERATE_GUIDED_FEEDBACK":
      sessionInput = buildFeedbackInput(session, payload, contexts, documentMetadata);
      break;
    case "GENERATE_GUIDED_STAGE_SUMMARY":
      sessionInput = buildSummaryInput(session, payload, contexts, documentMetadata);
      break;
  }
  const response = await invokeGateway(gateway, {
    schema_version: "model-gateway.v1",
    message_kind: "REQUEST",
    operation,
    provider_config: payload.provider_config,
    input: sessionInput,
  });
  return extractOutput(response, operation);
}

function buildDirectionsInput(
  payload: GuidedLearningGenerationJobPayload,
  contexts: Value[],
  documentMetadata: Value,
): Value {
  return {
    learning_goal: payload.learning_goal,
    document_metadata: documentMetadata,
    context_spans: contexts,
  };
}

function buildQuestionsInput(
  session: GuidedLearningSession,
  payload: GuidedLearningGenerationJobPayload,
  contexts: Value[],
  documentMetadata: Value,
): Value {
  return {
    learning_goal: payload.learning_goal,
    selected_direction: selectedDirection(session, payload),
    document_metadata: documentMetadata,
    context_spans: contexts,
  };
}

function buildFeedbackInput(
  session: GuidedLearningSession,
  payload: GuidedLearningGenerationJobPayload,
  contexts: Value[],
  documentMetadata: Value,
): Value {
  const question = currentQuestion(session);
  const questionValue = question as Value;
  if (typeof questionValue.user_answer !== "string" || !questionValue.user_answer.trim())
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Current answer is unavailable", false);
  return {
    learning_goal: payload.learning_goal,
    selected_direction: selectedDirection(session, payload),
    current_question: String(questionValue.prompt),
    current_question_order: Number(questionValue.order),
    user_answer: questionValue.user_answer,
    previous_question_history: questionHistory(session, false),
    document_metadata: documentMetadata,
    context_spans: contexts,
  };
}

function buildSummaryInput(
  session: GuidedLearningSession,
  payload: GuidedLearningGenerationJobPayload,
  contexts: Value[],
  documentMetadata: Value,
): Value {
  const questions = session.questions ?? [];
  return {
    learning_goal: payload.learning_goal,
    selected_direction: selectedDirection(session, payload),
    document_metadata: documentMetadata,
    question_history: questionHistory(session, true),
    completed_question_orders: questions.filter((item) => item.status === "CONFIRMED").map((item) => item.order),
    skipped_question_orders: questions.filter((item) => item.status === "SKIPPED").map((item) => item.order),
    context_spans: contexts,
  };
}

function selectedDirection(
  session: GuidedLearningSession,
  payload: GuidedLearningGenerationJobPayload,
): Value {
  const directionId = payload.selected_direction_id;
  if (typeof directionId !== "string")
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "selected_direction_id is required", false);
  const direction = session.candidate_directions.find((item) => item.direction_id === directionId);
  if (!direction)
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "selected_direction_id does not match a Session direction", false);
  return {
    direction_id: direction.direction_id,
    title: direction.title,
    description: direction.description,
    selection_basis: direction.selection_basis,
  };
}

function questionHistory(session: GuidedLearningSession, includeCurrent: boolean): Value[] {
  return (session.questions ?? [])
    .filter((item) => includeCurrent || item.status === "CONFIRMED" || item.status === "SKIPPED")
    .map((item) => {
      const value = item as unknown as Value;
      const feedback = isRecord(value.feedback) ? value.feedback : undefined;
      const reference = isRecord(value.reference_answer) ? value.reference_answer : undefined;
      return {
        question_id: item.question_id,
        question_order: item.order,
        question: item.prompt,
        status: item.status,
        user_answer: typeof value.user_answer === "string" ? value.user_answer : null,
        skipped: item.status === "SKIPPED",
        skip_reason: typeof value.skip_reason === "string" ? value.skip_reason : null,
        feedback_summary: typeof feedback?.summary === "string" ? feedback.summary : null,
        feedback_omissions: Array.isArray(feedback?.omissions)
          ? feedback.omissions.filter((entry): entry is string => typeof entry === "string")
          : [],
        reference_answer: typeof reference?.text === "string" ? reference.text : null,
      };
    });
}

async function invokeAnswer(gateway: GuidedLearningWorkerModelGateway, payload: GuidedLearningGenerationJobPayload, contexts: Value[], question: Value): Promise<Value> {
  const response = await invokeGateway(gateway, {
    schema_version: "model-gateway.v1", message_kind: "REQUEST", operation: "GENERATE_ANSWER", provider_config: payload.provider_config,
    input: { confirmed_question: { question_id: String(question.question_id), revision_id: `qrev_guided_${payload.expected_revision}`, text: String(question.prompt) }, context_spans: contexts, document_metadata: { document_version_id: payload.document_version_id, page_count: contexts.length } },
  });
  return extractOutput(response, "GENERATE_ANSWER");
}

async function invokeGateway(gateway: GuidedLearningWorkerModelGateway, request: unknown): Promise<unknown> {
  try { return await gateway.invoke(request); }
  catch (error) { throw new GuidedLearningWorkerError("MODEL_GATEWAY_FAILED", error instanceof Error ? error.message : String(error), true); }
}

function extractOutput(value: unknown, operation: string): Value {
  if (!isRecord(value) || value.schema_version !== "model-gateway.v1" || value.message_kind !== "RESPONSE" || value.operation !== operation || !isRecord(value.output))
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", `Model response for ${operation} is invalid`, false);
  return value.output;
}

export function resolveClaim(
  claim: unknown,
  contexts: Value[],
  documentVersionId: string,
): GuidedLearningClaimResolution {
  if (!isRecord(claim) || typeof claim.text !== "string" || typeof claim.claim_type !== "string")
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model claim output is malformed");
  if (!["PAPER_FACT", "AUTHOR_CLAIM", "AGENT_INFERENCE", "INSUFFICIENT_EVIDENCE"].includes(claim.claim_type))
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Model claim_type is invalid");
  if (claim.claim_type === "INSUFFICIENT_EVIDENCE")
    return insufficientClaimResolution(claim, "MODEL_INSUFFICIENT_EVIDENCE");
  const contextIdPresent = typeof claim.context_span_id === "string" && claim.context_span_id.length > 0;
  if (!contextIdPresent)
    return insufficientClaimResolution(claim, "CONTEXT_SPAN_ID_MISSING", {
      context_span_id_present: false,
    });
  const contextId = claim.context_span_id as string;
  const candidate = contexts.find((item) => item.context_span_id === contextId);
  if (!candidate)
    return insufficientClaimResolution(claim, "CONTEXT_SPAN_NOT_FOUND", {
      context_span_id_present: true,
      context_span_found: false,
    });
  const contextMetadata = {
    context_span_id_present: true,
    context_span_found: true,
    page_number: Number(candidate.page_number),
  };
  if (String(candidate.document_version_id) !== documentVersionId)
    return insufficientClaimResolution(claim, "DOCUMENT_VERSION_MISMATCH", {
      ...contextMetadata,
      document_version_matches: false,
    });
  const quote = typeof claim.evidence_quote_candidate === "string" ? claim.evidence_quote_candidate : "";
  const quotePresent = quote.length > 0;
  if (!quotePresent)
    return insufficientClaimResolution(claim, "QUOTE_MISSING", {
      ...contextMetadata,
      document_version_matches: true,
      quote_present: false,
      quote_codepoint_length: 0,
    });
  const pageText = Array.from(String(candidate.text));
  const quotePoints = Array.from(quote);
  const quoteMetadata = {
    ...contextMetadata,
    document_version_matches: true,
    quote_present: true,
    quote_codepoint_length: quotePoints.length,
  };
  if (quotePoints.length < 3)
    return insufficientClaimResolution(claim, "QUOTE_TOO_SHORT", quoteMetadata);
  if (quotePoints.length > 1000)
    return insufficientClaimResolution(claim, "QUOTE_TOO_LONG", quoteMetadata);
  const matches: number[] = [];
  for (let index = 0; index <= pageText.length - quotePoints.length; index++) {
    if (quotePoints.every((point, offset) => pageText[index + offset] === point)) matches.push(index);
  }
  const exactMatchCountBucket = matches.length === 0 ? "ZERO" : matches.length === 1 ? "ONE" : "MULTIPLE";
  if (matches.length === 0)
    return insufficientClaimResolution(claim, "QUOTE_NOT_FOUND", {
      ...quoteMetadata,
      exact_match_count_bucket: exactMatchCountBucket,
    });
  if (matches.length > 1)
    return insufficientClaimResolution(claim, "QUOTE_NOT_UNIQUE", {
      ...quoteMetadata,
      exact_match_count_bucket: exactMatchCountBucket,
    });
  const start = matches[0];
  const evidenceId = `evidence_guided_${createHash("sha256").update(`${contextId}:${start}:${quote}`).digest("hex").slice(0, 24)}`;
  return {
    text: claim.text,
    claim_type: claim.claim_type,
    evidence: {
      evidence_span_id: evidenceId,
      context_span_id: contextId,
      document_version_id: String(candidate.document_version_id),
      page_number: Number(candidate.page_number),
      page_text_sha256: String(candidate.page_text_sha256),
      extraction_profile_version: String(candidate.extraction_profile_version),
      char_start: start,
      char_end: start + quotePoints.length,
      quote,
      verification_status: "VERIFIED",
    },
    diagnostic: {
      model_claim_type: claim.claim_type,
      resolution_outcome: "VERIFIED",
      resolution_reason: "VERIFIED",
      ...quoteMetadata,
      exact_match_count_bucket: "ONE",
    },
  };
}

function insufficientClaimResolution(
  claim: Value,
  reason: GuidedLearningEvidenceResolutionReason,
  metadata: Partial<GuidedLearningEvidenceResolutionMetadata> = {},
): GuidedLearningClaimResolution {
  return {
    text: claim.text as string,
    claim_type: "INSUFFICIENT_EVIDENCE",
    diagnostic: {
      model_claim_type: claim.claim_type as string,
      resolution_outcome: "INSUFFICIENT_EVIDENCE",
      resolution_reason: reason,
      exact_match_count_bucket: "NOT_CHECKED",
      ...metadata,
    },
  };
}

function safeLogEvidenceResolution(
  logger: GuidedLearningEvidenceResolutionLogger,
  event: GuidedLearningEvidenceResolutionEvent,
): void {
  try {
    logger.log(event);
  } catch {
    // Diagnostics are observational and must never affect the feedback result.
  }
}

function parsePayload(value: unknown, operation: GuidedLearningJobKind): GuidedLearningGenerationJobPayload {
  if (!isRecord(value) || value.schema_version !== "guided-learning.v1" || value.operation !== operation || typeof value.session_id !== "string" || typeof value.project_id !== "string" || typeof value.document_version_id !== "string" || typeof value.learning_goal !== "string" || !Number.isInteger(value.expected_revision) || typeof value.expected_state !== "string" || !isRecord(value.provider_config) || typeof value.provider_config.provider !== "string")
    throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Guided Learning job payload is invalid", false);
  if (
    operation === "GUIDED_LEARNING_FEEDBACK_GENERATION" &&
    (typeof value.question_id !== "string" ||
      value.question_id.length === 0 ||
      !Number.isInteger(value.question_order) ||
      Number(value.question_order) < 1)
  )
    throw new GuidedLearningWorkerError(
      "VALIDATION_FAILED",
      "Feedback generation job requires a question pointer",
      false,
    );
  return value as unknown as GuidedLearningGenerationJobPayload;
}

async function recordFailureIfCurrent(repository: GuidedLearningSessionRepository, payload: GuidedLearningGenerationJobPayload, error: unknown, now: () => string): Promise<void> {
  const session = repository.get(payload.session_id);
  if (!session || session.session_revision !== payload.expected_revision || session.state !== payload.expected_state) return;
  const retryable = error instanceof GuidedLearningWorkerError ? error.retryable : true;
  const failedOperation = operationToFailure(payload.operation);
  const timestamp = now();
  const next = structuredClone(session) as unknown as Value;
  const failure = {
    failure_id: `failure_${createHash("sha256").update(`${payload.session_id}:${payload.expected_revision}`).digest("hex").slice(0, 24)}`,
    failure_class: retryable ? "RETRYABLE" : "PERMANENT", error_code: retryable ? "GENERATION_FAILED" : "CONTRACT_REJECTED",
    message: error instanceof Error ? error.message.slice(0, 500) : String(error), attempt: 1, failed_operation: failedOperation, resume_state: payload.expected_state,
  };
  const result = applyGuidedLearningEvent({ state: session.state, event: retryable ? "RETRYABLE_FAILURE" : "PERMANENT_FAILURE", failureContext: failure as never });
  if (result.outcome === "REJECTED") return;
  next.state = result.to_state; next.failure = failure; next.session_revision = session.session_revision + 1; next.state_version = session.state_version + 1; next.updated_at = timestamp;
  assertConsistent(next as unknown as GuidedLearningSession);
  repository.saveFailure(next as unknown as GuidedLearningSession, payload.expected_revision, { failure_id: failure.failure_id, failed_operation: failedOperation, resume_state: payload.expected_state, error_code: failure.error_code, error_message: failure.message, retryable, failed_at: timestamp });
}

function operationToFailure(operation: GuidedLearningJobKind): GuidedLearningFailure["failed_operation"] {
  switch (operation) {
    case "GUIDED_LEARNING_DIRECTION_GENERATION": return "GENERATE_DIRECTIONS";
    case "GUIDED_LEARNING_QUESTION_GENERATION": return "GENERATE_QUESTIONS";
    case "GUIDED_LEARNING_FEEDBACK_GENERATION": return "GENERATE_FEEDBACK";
    case "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION": return "GENERATE_STAGE_SUMMARY";
  }
}

function completedStateFor(operation: GuidedLearningJobKind): string {
  switch (operation) {
    case "GUIDED_LEARNING_DIRECTION_GENERATION": return "AWAITING_DIRECTION_SELECTION";
    case "GUIDED_LEARNING_QUESTION_GENERATION": return "AWAITING_ANSWER";
    case "GUIDED_LEARNING_FEEDBACK_GENERATION": return "FEEDBACK_READY";
    case "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION": return "STAGE_COMPLETED";
  }
}

function assertConsistent(session: GuidedLearningSession): void {
  const result = validateGuidedLearningSessionConsistency(session);
  if (!result.valid) throw new GuidedLearningWorkerError("VALIDATION_FAILED", result.errors.map((error) => `${error.code}: ${error.message}`).join("; "), false);
}

function currentQuestion(session: GuidedLearningSession): Value {
  const question = session.questions?.find((item) => item.order === session.current_question_order);
  if (!question) throw new GuidedLearningWorkerError("VALIDATION_FAILED", "Current question is unavailable", false);
  return question as unknown as Value;
}

function requireFeedbackPointer(
  payload: GuidedLearningGenerationJobPayload,
  session: GuidedLearningSession,
): void {
  if (
    typeof payload.question_id !== "string" ||
    payload.question_id.length === 0 ||
    !Number.isInteger(payload.question_order) ||
    Number(payload.question_order) < 1
  )
    throw new GuidedLearningWorkerError(
      "VALIDATION_FAILED",
      "Feedback generation job requires a question pointer",
      false,
    );
  const question = currentQuestion(session);
  if (
    payload.question_id !== question.question_id ||
    payload.question_order !== question.order
  )
    throw new GuidedLearningWorkerError(
      "REVISION_CONFLICT",
      "Feedback question pointer changed",
      false,
    );
}

function contextSpans(documentVersionId: string, pages: readonly DocumentPageRecord[]): Value[] {
  return pages.filter((page) => page.canonicalPageText.length > 0).map((page) => ({ context_span_id: `context_${documentVersionId}_${page.pageNumber}`, document_version_id: documentVersionId, page_number: page.pageNumber, char_start: 0, char_end: page.codePointLength, text: page.canonicalPageText, page_text_sha256: page.pageTextSha256, extraction_profile_version: page.extractionProfileVersion }));
}

function takeCodePoints(value: string, start: number, end: number): string { return Array.from(value).slice(start, end).join(""); }

class GuidedLearningWorkerError extends Error {
  constructor(readonly code: "NOT_FOUND" | "VALIDATION_FAILED" | "INVALID_STATE_TRANSITION" | "REVISION_CONFLICT" | "MODEL_GATEWAY_FAILED" | "EVIDENCE_NOT_READY", message: string, readonly retryable = false) { super(message); this.name = "GuidedLearningWorkerError"; }
}

function isRecord(value: unknown): value is Value { return typeof value === "object" && value !== null && !Array.isArray(value); }
