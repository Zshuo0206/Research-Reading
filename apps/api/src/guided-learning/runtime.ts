import { createHash, randomUUID } from "node:crypto";
import type {
  GuidedLearningCommandName,
  GuidedLearningEvent,
  GuidedLearningFailure,
  GuidedLearningSession,
  GuidedLearningState,
} from "../../../../packages/contracts/dist/wave1/src/index.js";
import {
  applyGuidedLearningEvent,
  GUIDED_LEARNING_CLIENT_COMMANDS,
  GUIDED_LEARNING_CONTRACT_VERSION,
  validateGuidedLearningSessionConsistency,
} from "../../../../packages/contracts/dist/wave1/src/index.js";
import type { GuidedLearningCommandRecord } from "../../../../packages/storage/dist/index.js";
import {
  type GuidedLearningGenerationJobPayload,
  type GuidedLearningJobKind,
  type GuidedLearningJobWrite,
  type GuidedLearningProviderConfig,
  type GuidedLearningSessionRepository,
  GuidedLearningStorageError,
} from "../../../../packages/storage/dist/index.js";
import { GuidedLearningMockAdapter } from "./mock.js";

type Value = Record<string, unknown>;
type CommandResult = {
  outcome: "APPLIED" | "IDEMPOTENT";
  transition: {
    from_state: GuidedLearningState;
    to_state: GuidedLearningState;
    result_revision: number;
  };
  session: GuidedLearningSession;
  job_id?: string;
};

export class GuidedLearningRuntimeError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "INVALID_COMMAND"
      | "INVALID_STATE_TRANSITION"
      | "VALIDATION_FAILED"
      | "IDEMPOTENCY_CONFLICT"
      | "REVISION_CONFLICT"
      | "EVIDENCE_NOT_READY"
      | "RETRY_NOT_ALLOWED"
      | "INTERNAL_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "GuidedLearningRuntimeError";
  }
}

export class GuidedLearningRuntime {
  constructor(
    private readonly repository: GuidedLearningSessionRepository,
    private readonly mock = new GuidedLearningMockAdapter(),
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  createSession(input: {
    project_id: string;
    document_version_id: string;
    learning_goal: string;
    provider_config?: GuidedLearningProviderConfig;
  }): GuidedLearningSession {
    const session = this.newSession(input);
    this.repository.create(session, undefined, input.provider_config);
    return session;
  }

  requestDirectionsGeneration(input: {
    project_id: string;
    document_version_id: string;
    learning_goal: string;
    provider_config?: GuidedLearningProviderConfig;
  }): { session: GuidedLearningSession; job_id: string } {
    const session = this.newSession(input);
    const job = this.generationJob(
      session,
      "GUIDED_LEARNING_DIRECTION_GENERATION",
      "CREATED",
      undefined,
      input.provider_config,
    );
    this.repository.create(session, job, input.provider_config);
    return { session, job_id: job.job_id };
  }

  getSession(sessionId: string): GuidedLearningSession {
    const session = this.repository.get(sessionId);
    if (!session)
      throw new GuidedLearningRuntimeError(
        "NOT_FOUND",
        "Guided learning session not found",
      );
    return session;
  }

  generateDirections(sessionId: string): GuidedLearningSession {
    const session = this.getSession(sessionId);
    const next = this.advance(session, "DIRECTIONS_READY");
    next.candidate_directions = this.mock.directions();
    this.commit(session, next);
    return next;
  }

  writeQuestions(
    sessionId: string,
    questions = this.mock.questions(),
  ): GuidedLearningSession {
    const session = this.getSession(sessionId);
    if (session.state !== "QUESTIONS_GENERATING")
      throw new GuidedLearningRuntimeError(
        "INVALID_STATE_TRANSITION",
        "Questions can only be written while generating",
      );
    if (questions.length < 3 || questions.length > 7)
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "Questions must contain 3 to 7 items",
      );
    const next = this.advance(session, "QUESTIONS_READY");
    next.questions = questions.map((question, index) => ({
      ...question,
      order: index + 1,
      status: index === 0 ? "ACTIVE" : "UNSEEN",
    })) as unknown as GuidedLearningSession["questions"];
    next.current_stage_id = "UNDERSTAND";
    next.current_question_order = 1;
    this.commit(session, next);
    return next;
  }

  writeFeedback(input: {
    session_id: string;
    feedback: Value;
    reference_answer: Value;
    evidence: Value[];
  }): GuidedLearningSession {
    const session = this.getSession(input.session_id);
    if (session.state !== "ANSWER_SUBMITTED")
      throw new GuidedLearningRuntimeError(
        "INVALID_STATE_TRANSITION",
        "Feedback requires ANSWER_SUBMITTED",
      );
    const next = this.advance(session, "FEEDBACK_READY");
    const question = this.currentQuestion(next);
    question.status = "FEEDBACK_READY";
    question.feedback = input.feedback;
    question.reference_answer = input.reference_answer;
    question.evidence = input.evidence;
    this.commit(session, next);
    return next;
  }

  writeSummary(sessionId: string, summary: Value): GuidedLearningSession {
    const session = this.getSession(sessionId);
    if (session.state !== "SUMMARY_GENERATING")
      throw new GuidedLearningRuntimeError(
        "INVALID_STATE_TRANSITION",
        "Summary requires SUMMARY_GENERATING",
      );
    const next = this.advance(session, "SUMMARY_READY");
    next.stage_summary = summary as unknown as NonNullable<
      GuidedLearningSession["stage_summary"]
    >;
    this.requireRoute(next).stages[0].status = "COMPLETED";
    this.commit(session, next);
    return next;
  }

  completeSession(sessionId: string): GuidedLearningSession {
    const session = this.getSession(sessionId);
    const next = this.advance(session, "COMPLETE_SESSION");
    this.commit(session, next);
    return next;
  }

  recordFailure(input: {
    session_id: string;
    failed_operation: GuidedLearningFailure["failed_operation"];
    error_code: GuidedLearningFailure["error_code"];
    message: string;
    retryable: boolean;
  }): GuidedLearningSession {
    const session = this.getSession(input.session_id);
    const resumeState = failureResumeState(session);
    if (!isFailureShape(input.failed_operation, resumeState))
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "Failure operation and resume state do not match",
      );
    const failure = {
      failure_id: `failure_${randomUUID()}`,
      failure_class: input.retryable ? "RETRYABLE" : "PERMANENT",
      error_code: input.error_code,
      message: input.message,
      attempt: 1,
      failed_operation: input.failed_operation,
      resume_state: resumeState,
    } as unknown as GuidedLearningFailure;
    const next = this.advance(
      session,
      input.retryable ? "RETRYABLE_FAILURE" : "PERMANENT_FAILURE",
    );
    next.failure = failure;
    this.assertConsistent(next);
    this.repository.saveFailure(next, session.session_revision, {
      failure_id: failure.failure_id,
      failed_operation: input.failed_operation,
      resume_state: resumeState,
      error_code: input.error_code,
      error_message: input.message,
      retryable: input.retryable,
      failed_at: next.updated_at,
    });
    return next;
  }

  executeCommand(input: {
    session_id: string;
    contract_version: string;
    event: string;
    payload: unknown;
    idempotency_key: string;
  }): CommandResult {
    if (input.contract_version !== GUIDED_LEARNING_CONTRACT_VERSION)
      throw new GuidedLearningRuntimeError(
        "INVALID_COMMAND",
        "Unsupported contract_version",
      );
    if (!input.idempotency_key)
      throw new GuidedLearningRuntimeError(
        "INVALID_COMMAND",
        "idempotency_key is required",
      );
    if (
      !(GUIDED_LEARNING_CLIENT_COMMANDS as readonly string[]).includes(
        input.event,
      )
    )
      throw new GuidedLearningRuntimeError(
        "INVALID_COMMAND",
        "Event is not a client command",
      );
    const event = input.event as GuidedLearningCommandName;
    const fingerprint = fingerprintOf({
      contract_version: input.contract_version,
      event,
      payload: input.payload,
    });
    const prior = this.repository.findCommand(input.idempotency_key);
    if (prior)
      return this.replayOrConflict(prior, input.session_id, event, fingerprint);
    const session = this.getSession(input.session_id);
    const next = this.applyClientCommand(session, event, input.payload);
    const transition = applyGuidedLearningEvent({
      state: session.state,
      event,
      idempotencyKey: input.idempotency_key,
      sessionId: session.session_id,
      requestFingerprint: fingerprint,
      resultRevision: next.session_revision,
      hasRemainingQuestions:
        event === "ADVANCE_QUESTION" ? hasRemaining(session) : undefined,
      failureContext: session.failure,
      resumeShapeValidated: event === "RETRY" ? true : undefined,
      canConfirmCurrentQuestion:
        event === "CONFIRM_QUESTION"
          ? evidenceReady(this.currentQuestion(session))
          : undefined,
    });
    if (transition.outcome === "REJECTED")
      this.rejectTransition(transition.reason);
    const job = this.jobForCommand(session, next, event);
    const result: CommandResult = {
      outcome: "APPLIED",
      transition,
      session: next,
      job_id: job?.job_id,
    };
    try {
      this.assertConsistent(next);
      this.repository.save(next, session.session_revision, {
        command: {
          idempotency_key: input.idempotency_key,
          session_id: session.session_id,
          event,
          request_fingerprint: fingerprint,
          from_state: transition.from_state,
          to_state: transition.to_state,
          actor: transition.actor,
          result_revision: transition.result_revision,
          result,
          created_at: next.updated_at,
        },
        supersedeActiveFailuresAt:
          event === "RETRY" ? next.updated_at : undefined,
        job,
      });
    } catch (error) {
      if (
        error instanceof GuidedLearningStorageError &&
        error.code === "IDEMPOTENCY_CONFLICT" &&
        error.command
      )
        return this.replayOrConflict(
          error.command,
          input.session_id,
          event,
          fingerprint,
        );
      throw mapStorageError(error);
    }
    return result;
  }

  private newSession(input: {
    project_id: string;
    document_version_id: string;
    learning_goal: string;
    provider_config?: GuidedLearningProviderConfig;
  }): GuidedLearningSession {
    if (
      !input.project_id ||
      !input.document_version_id ||
      !input.learning_goal?.trim()
    )
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "project_id, document_version_id and learning_goal are required",
      );
    const timestamp = this.now();
    const session = {
      session_id: `learning_${randomUUID()}`,
      project_id: input.project_id,
      document_version_id: input.document_version_id,
      mode: "GUIDED_LEARNING",
      learning_goal: input.learning_goal.trim(),
      state: "CREATED",
      session_revision: 1,
      state_version: 1,
      candidate_directions: [],
      created_at: timestamp,
      updated_at: timestamp,
    } as unknown as GuidedLearningSession;
    this.assertConsistent(session);
    return session;
  }

  private jobForCommand(
    previous: GuidedLearningSession,
    next: GuidedLearningSession,
    event: GuidedLearningCommandName,
  ): GuidedLearningJobWrite | undefined {
    if (event === "START_STAGE")
      return this.generationJob(
        next,
        "GUIDED_LEARNING_QUESTION_GENERATION",
        "QUESTIONS_GENERATING",
      );
    if (event === "SUBMIT_ANSWER" || event === "EDIT_ANSWER")
      return this.generationJob(
        next,
        "GUIDED_LEARNING_FEEDBACK_GENERATION",
        "ANSWER_SUBMITTED",
        this.currentQuestion(next),
      );
    if (event === "ADVANCE_QUESTION" && !hasRemaining(previous))
      return this.generationJob(
        next,
        "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION",
        "SUMMARY_GENERATING",
      );
    if (event === "RETRY" && previous.failure) {
      const operation = operationToJobKind(previous.failure.failed_operation);
      const question = requiresQuestionPointer(operation)
        ? this.currentQuestion(next)
        : undefined;
      return this.generationJob(
        next,
        operation,
        next.state as GuidedLearningGenerationJobPayload["expected_state"],
        question,
      );
    }
    return undefined;
  }

  private generationJob(
    session: GuidedLearningSession,
    operation: GuidedLearningJobKind,
    expectedState: GuidedLearningGenerationJobPayload["expected_state"],
    question?: Value,
    providerConfig?: GuidedLearningProviderConfig,
  ): GuidedLearningJobWrite {
    const jobId = `job_${randomUUID()}`;
    const payload: GuidedLearningGenerationJobPayload = {
      schema_version: GUIDED_LEARNING_CONTRACT_VERSION,
      operation,
      session_id: session.session_id,
      project_id: session.project_id,
      document_version_id: session.document_version_id,
      learning_goal: session.learning_goal,
      expected_revision: session.session_revision,
      expected_state: expectedState,
      provider_config:
        providerConfig ?? this.repository.getProviderConfig(session.session_id),
    };
    if (typeof session.selected_direction_id === "string")
      payload.selected_direction_id = session.selected_direction_id;
    if (requiresQuestionPointer(operation)) {
      if (
        !question ||
        typeof question.question_id !== "string" ||
        question.question_id.length === 0 ||
        !Number.isInteger(question.order) ||
        Number(question.order) < 1
      )
        throw new GuidedLearningRuntimeError(
          "VALIDATION_FAILED",
          "Feedback generation job requires a valid current question pointer",
        );
      payload.question_id = String(question.question_id);
      payload.question_order = Number(question.order);
    } else if (question)
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "Non-feedback generation job cannot contain a question pointer",
      );
    return {
      job_id: jobId,
      kind: operation,
      payload,
      idempotency_key: `guided-learning:${session.session_id}:${operation}:${session.session_revision}`,
      max_attempts: 3,
      created_at: session.updated_at,
    };
  }

  private applyClientCommand(
    session: GuidedLearningSession,
    event: GuidedLearningCommandName,
    payload: unknown,
  ): GuidedLearningSession {
    const next = this.advance(session, event);
    const value = objectPayload(payload);
    switch (event) {
      case "SELECT_DIRECTION":
        requireKeys(value, ["direction_id"]);
        if (
          typeof value.direction_id !== "string" ||
          !session.candidate_directions.some(
            (item) => item.direction_id === value.direction_id,
          )
        )
          throw new GuidedLearningRuntimeError(
            "VALIDATION_FAILED",
            "direction_id is invalid",
          );
        next.selected_direction_id = value.direction_id;
        next.route = canonicalRoute(this.now()) as unknown as NonNullable<
          GuidedLearningSession["route"]
        >;
        next.current_stage_id = "UNDERSTAND";
        break;
      case "START_STAGE":
        requireKeys(value, ["stage_id"]);
        if (value.stage_id !== "UNDERSTAND")
          throw new GuidedLearningRuntimeError(
            "VALIDATION_FAILED",
            "Only UNDERSTAND is available in v1",
          );
        break;
      case "SUBMIT_ANSWER":
      case "EDIT_ANSWER":
        requireKeys(value, ["question_id", "question_order", "answer"]);
        this.requirePointer(session, value);
        if (typeof value.answer !== "string" || !value.answer.trim())
          throw new GuidedLearningRuntimeError(
            "VALIDATION_FAILED",
            "answer is required",
          );
        this.currentQuestion(next).status = "ANSWERED";
        this.currentQuestion(next).confirmation_status = "PENDING";
        this.currentQuestion(next).user_answer = value.answer;
        delete this.currentQuestion(next).skip_reason;
        delete this.currentQuestion(next).feedback;
        delete this.currentQuestion(next).reference_answer;
        delete this.currentQuestion(next).evidence;
        break;
      case "SKIP_QUESTION":
        requireKeys(value, ["question_id", "question_order", "reason"]);
        this.requirePointer(session, value);
        if (value.reason !== "I_DONT_KNOW")
          throw new GuidedLearningRuntimeError(
            "VALIDATION_FAILED",
            "Unsupported skip reason",
          );
        this.currentQuestion(next).status = "SKIPPED";
        this.currentQuestion(next).confirmation_status = "SKIPPED";
        this.currentQuestion(next).skip_reason = "I_DONT_KNOW";
        break;
      case "CONFIRM_QUESTION":
        requireKeys(value, ["question_id", "question_order"]);
        this.requirePointer(session, value);
        if (!evidenceReady(this.currentQuestion(session)))
          throw new GuidedLearningRuntimeError(
            "EVIDENCE_NOT_READY",
            "Current question Evidence is not ready",
          );
        this.currentQuestion(next).status = "CONFIRMED";
        this.currentQuestion(next).confirmation_status = "CONFIRMED";
        break;
      case "ADVANCE_QUESTION":
        requireKeys(value, ["question_id", "question_order"]);
        this.requirePointer(session, value);
        if (hasRemaining(session)) {
          const nextOrder = Number(value.question_order) + 1;
          delete next.current_question_order;
          const question = this.questions(next).find(
            (item) => item.order === nextOrder,
          );
          if (!question)
            throw new GuidedLearningRuntimeError(
              "VALIDATION_FAILED",
              "Next question is unavailable",
            );
          question.status = "ACTIVE";
          question.confirmation_status = "PENDING";
          next.current_question_order = nextOrder;
        } else delete next.current_question_order;
        break;
      case "RETRY":
        requireKeys(value, []);
        if (session.state !== "RETRYABLE_FAILURE" || !session.failure)
          throw new GuidedLearningRuntimeError(
            "RETRY_NOT_ALLOWED",
            "Session has no retryable failure",
          );
        delete next.failure;
        break;
    }
    return next;
  }

  private advance(
    session: GuidedLearningSession,
    event: GuidedLearningEvent,
  ): GuidedLearningSession {
    const next = structuredClone(session) as unknown as Value;
    next.state = targetState(
      session.state,
      event,
      session.failure,
      event === "ADVANCE_QUESTION" ? hasRemaining(session) : undefined,
    );
    next.session_revision = session.session_revision + 1;
    next.state_version = session.state_version + 1;
    next.updated_at = this.now();
    return next as unknown as GuidedLearningSession;
  }
  private commit(
    previous: GuidedLearningSession,
    next: GuidedLearningSession,
  ): void {
    this.assertConsistent(next);
    try {
      this.repository.save(next, previous.session_revision);
    } catch (error) {
      throw mapStorageError(error);
    }
  }
  private assertConsistent(session: GuidedLearningSession): void {
    const result = validateGuidedLearningSessionConsistency(session);
    if (!result.valid)
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        result.errors
          .map((error) => `${error.code}: ${error.message}`)
          .join("; "),
      );
  }
  private currentQuestion(session: GuidedLearningSession): Value {
    const question = this.questions(session).find(
      (item) => item.order === session.current_question_order,
    );
    if (!question)
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "Current question is unavailable",
      );
    return question;
  }
  private questions(session: GuidedLearningSession): Value[] {
    if (!Array.isArray(session.questions))
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "Questions are unavailable",
      );
    return session.questions as unknown as Value[];
  }
  private requireRoute(
    session: GuidedLearningSession,
  ): Value & { stages: Value[] } {
    const route = session.route as unknown as Value | undefined;
    if (!route || !Array.isArray(route.stages))
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "Route is unavailable",
      );
    return route as Value & { stages: Value[] };
  }
  private requirePointer(session: GuidedLearningSession, payload: Value): void {
    const question = this.currentQuestion(session);
    if (
      payload.question_id !== question.question_id ||
      payload.question_order !== question.order
    )
      throw new GuidedLearningRuntimeError(
        "VALIDATION_FAILED",
        "Question pointer does not match current question",
      );
  }
  private rejectTransition(reason: string): never {
    if (reason === "EVIDENCE_NOT_READY")
      throw new GuidedLearningRuntimeError(
        "EVIDENCE_NOT_READY",
        "Current question Evidence is not ready",
      );
    if (reason === "ILLEGAL_TRANSITION")
      throw new GuidedLearningRuntimeError(
        "INVALID_STATE_TRANSITION",
        "Event is not allowed in the current state",
      );
    if (reason.includes("IDEMPOTENCY"))
      throw new GuidedLearningRuntimeError("IDEMPOTENCY_CONFLICT", reason);
    throw new GuidedLearningRuntimeError("VALIDATION_FAILED", reason);
  }
  private replayOrConflict(
    prior: GuidedLearningCommandRecord,
    sessionId: string,
    event: GuidedLearningCommandName,
    fingerprint: string,
  ): CommandResult {
    if (
      prior.session_id !== sessionId ||
      prior.event !== event ||
      prior.request_fingerprint !== fingerprint
    )
      throw new GuidedLearningRuntimeError(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency key is bound to a different request",
      );
    return JSON.parse(prior.result_json) as CommandResult;
  }
}

function objectPayload(value: unknown): Value {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new GuidedLearningRuntimeError(
      "INVALID_COMMAND",
      "payload must be an object",
    );
  return value as Value;
}
function requireKeys(value: Value, keys: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw new GuidedLearningRuntimeError(
      "INVALID_COMMAND",
      "payload contains unsupported fields",
    );
}
function fingerprintOf(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
function targetState(
  from: GuidedLearningState,
  event: GuidedLearningEvent,
  failure?: GuidedLearningFailure,
  remaining?: boolean,
): GuidedLearningState {
  const client = (
    GUIDED_LEARNING_CLIENT_COMMANDS as readonly string[]
  ).includes(event);
  const fallbackFailure = {
    failure_id: "failure_internal",
    failure_class: "RETRYABLE",
    error_code: "GENERATION_FAILED",
    message: "retry",
    attempt: 1,
    failed_operation:
      from === "CREATED"
        ? "GENERATE_DIRECTIONS"
        : from === "ANSWER_SUBMITTED"
          ? "GENERATE_FEEDBACK"
          : from === "QUESTION_COMPLETED" || from === "SUMMARY_GENERATING"
            ? "GENERATE_STAGE_SUMMARY"
            : "GENERATE_QUESTIONS",
    resume_state: from,
  } as unknown as GuidedLearningFailure;
  const result = applyGuidedLearningEvent({
    state: from,
    event,
    idempotencyKey: client ? "internal-transition" : undefined,
    sessionId: client ? "internal-session" : undefined,
    requestFingerprint: client ? "internal-fingerprint" : undefined,
    hasRemainingQuestions:
      event === "ADVANCE_QUESTION" ? (remaining ?? true) : undefined,
    evidenceReady: event === "CONFIRM_QUESTION" ? true : undefined,
    resumeShapeValidated: event === "RETRY" ? true : undefined,
    failureContext: failure ?? fallbackFailure,
  });
  if (result.outcome === "REJECTED")
    throw new GuidedLearningRuntimeError(
      "INVALID_STATE_TRANSITION",
      result.reason,
    );
  return result.to_state;
}
function canonicalRoute(lockedAt: string): Value {
  return {
    route_id: `route_${randomUUID()}`,
    route_version: "guided-route.v1",
    locked: true,
    locked_at: lockedAt,
    stages: [
      {
        stage_id: "UNDERSTAND",
        order: 1,
        title: "理解内容",
        status: "OPEN",
        unlock_condition: "SESSION_DIRECTION_SELECTED",
      },
      {
        stage_id: "ANALYZE",
        order: 2,
        title: "分析评价",
        status: "LOCKED",
        unlock_condition: "NOT_AVAILABLE_IN_V1",
      },
      {
        stage_id: "TRANSFER",
        order: 3,
        title: "迁移应用",
        status: "LOCKED",
        unlock_condition: "NOT_AVAILABLE_IN_V1",
      },
    ],
  };
}
function hasRemaining(session: GuidedLearningSession): boolean {
  const order = session.current_question_order ?? 0;
  return (session.questions ?? []).some((question) => question.order > order);
}
function evidenceReady(question: Value): boolean {
  const reference = question.reference_answer as Value | undefined;
  const evidence = Array.isArray(question.evidence)
    ? (question.evidence as Value[])
    : [];
  if (!reference || evidence.length === 0) return false;
  const byId = new Map(evidence.map((item) => [item.evidence_span_id, item]));
  const claims = Array.isArray(reference.claims)
    ? (reference.claims as Value[])
    : [];
  return (
    claims.length > 0 &&
    claims.every((claim) =>
      claim.claim_type === "INSUFFICIENT_EVIDENCE"
        ? Array.isArray(claim.evidence_refs) && claim.evidence_refs.length === 0
        : Array.isArray(claim.evidence_refs) &&
          claim.evidence_refs.length > 0 &&
          claim.evidence_refs.every(
            (id) => byId.get(id)?.verification_status === "VERIFIED",
          ),
    )
  );
}
function failureResumeState(session: GuidedLearningSession): string {
  return session.state === "RETRYABLE_FAILURE" || session.state === "FAILED"
    ? String(session.failure?.resume_state)
    : session.state;
}
function isFailureShape(
  operation: GuidedLearningFailure["failed_operation"],
  state: string,
): boolean {
  return (
    (operation === "GENERATE_DIRECTIONS" && state === "CREATED") ||
    (operation === "GENERATE_QUESTIONS" &&
      (state === "ROUTE_LOCKED" || state === "QUESTIONS_GENERATING")) ||
    (operation === "GENERATE_FEEDBACK" && state === "ANSWER_SUBMITTED") ||
    (operation === "GENERATE_STAGE_SUMMARY" &&
      (state === "QUESTION_COMPLETED" || state === "SUMMARY_GENERATING"))
  );
}

function operationToJobKind(
  operation: GuidedLearningFailure["failed_operation"],
): GuidedLearningJobKind {
  switch (operation) {
    case "GENERATE_DIRECTIONS":
      return "GUIDED_LEARNING_DIRECTION_GENERATION";
    case "GENERATE_QUESTIONS":
      return "GUIDED_LEARNING_QUESTION_GENERATION";
    case "GENERATE_FEEDBACK":
      return "GUIDED_LEARNING_FEEDBACK_GENERATION";
    case "GENERATE_STAGE_SUMMARY":
      return "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION";
  }
}

function requiresQuestionPointer(operation: GuidedLearningJobKind): boolean {
  return operation === "GUIDED_LEARNING_FEEDBACK_GENERATION";
}
function mapStorageError(error: unknown): GuidedLearningRuntimeError {
  if (error instanceof GuidedLearningRuntimeError) return error;
  if (error instanceof GuidedLearningStorageError) {
    if (
      error.code === "NOT_FOUND" ||
      error.code === "REVISION_CONFLICT" ||
      error.code === "IDEMPOTENCY_CONFLICT"
    )
      return new GuidedLearningRuntimeError(error.code, error.message);
    return new GuidedLearningRuntimeError(
      "INTERNAL_ERROR",
      "Guided learning persistence failed",
    );
  }
  return new GuidedLearningRuntimeError(
    "INTERNAL_ERROR",
    "Guided learning persistence failed",
  );
}
