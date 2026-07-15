import type { Wave1GuidedLearningSessionAndStateMachine } from "../generated/guided-learning.v1.d.ts";

type GeneratedContract = Wave1GuidedLearningSessionAndStateMachine;
type GeneratedSession = Extract<
  GeneratedContract,
  { message_kind: "SESSION" }
>["session"];
type GeneratedQuestion = NonNullable<GeneratedSession["questions"]>[number];
type GeneratedEvidence = NonNullable<GeneratedQuestion["evidence"]>[number];

export const GUIDED_LEARNING_CONTRACT_VERSION = "guided-learning.v1" as const;

export const GUIDED_LEARNING_STATES = [
  "CREATED",
  "AWAITING_DIRECTION_SELECTION",
  "ROUTE_LOCKED",
  "QUESTIONS_GENERATING",
  "AWAITING_ANSWER",
  "ANSWER_SUBMITTED",
  "FEEDBACK_READY",
  "QUESTION_COMPLETED",
  "SUMMARY_GENERATING",
  "STAGE_COMPLETED",
  "SESSION_COMPLETED",
  "RETRYABLE_FAILURE",
  "FAILED",
] as const;

export type GuidedLearningState = (typeof GUIDED_LEARNING_STATES)[number];

export type GuidedLearningCandidateDirection =
  GeneratedSession["candidate_directions"][number];

export interface GuidedLearningRouteStage {
  stage_id: "UNDERSTAND" | "ANALYZE" | "TRANSFER";
  order: 1 | 2 | 3;
  title: string;
  status: "LOCKED" | "OPEN" | "COMPLETED";
  unlock_condition:
    | "SESSION_DIRECTION_SELECTED"
    | "PREVIOUS_STAGE_COMPLETED"
    | "NOT_AVAILABLE_IN_V1";
}

export interface GuidedLearningRoute {
  route_id: string;
  route_version: "guided-route.v1";
  locked: true;
  locked_at: string;
  stages: [
    GuidedLearningRouteStage & {
      stage_id: "UNDERSTAND";
      order: 1;
      status: "OPEN" | "COMPLETED";
      unlock_condition: "SESSION_DIRECTION_SELECTED";
    },
    GuidedLearningRouteStage & {
      stage_id: "ANALYZE";
      order: 2;
      status: "LOCKED";
      unlock_condition: "NOT_AVAILABLE_IN_V1";
    },
    GuidedLearningRouteStage & {
      stage_id: "TRANSFER";
      order: 3;
      status: "LOCKED";
      unlock_condition: "NOT_AVAILABLE_IN_V1";
    },
  ];
}

export interface GuidedLearningFeedback {
  summary: string;
  omissions: string[];
}

export interface GuidedLearningClaim {
  text: string;
  claim_type:
    | "PAPER_FACT"
    | "AUTHOR_CLAIM"
    | "AGENT_INFERENCE"
    | "INSUFFICIENT_EVIDENCE";
  evidence_refs: string[];
}

export interface GuidedLearningReferenceAnswer {
  text: string;
  claims: GuidedLearningClaim[];
}

export type GuidedLearningQuestion = {
  question_id: string;
  order: number;
  stage_id: "UNDERSTAND";
  prompt: string;
} & (
  | {
      status: "UNSEEN" | "ACTIVE";
      confirmation_status: "PENDING";
    }
  | {
      status: "ANSWERED";
      confirmation_status: "PENDING";
      user_answer: string;
    }
  | {
      status: "SKIPPED";
      confirmation_status: "SKIPPED";
      skip_reason: "I_DONT_KNOW";
    }
  | {
      status: "FEEDBACK_READY";
      confirmation_status: "PENDING";
      user_answer: string;
      feedback: GuidedLearningFeedback;
      reference_answer: GuidedLearningReferenceAnswer;
      evidence: GeneratedEvidence[];
    }
  | {
      status: "CONFIRMED";
      confirmation_status: "CONFIRMED";
      user_answer: string;
      feedback: GuidedLearningFeedback;
      reference_answer: GuidedLearningReferenceAnswer;
      evidence: GeneratedEvidence[];
    }
);

export interface GuidedLearningStageSummary {
  stage_id: "UNDERSTAND";
  status: "GENERATED";
  completed_question_orders: number[];
  skipped_question_orders: number[];
  key_mastery_points: string[];
  major_weak_points: string[];
  next_stage_hint: string;
}

export type GuidedLearningFailureOperation =
  | "GENERATE_DIRECTIONS"
  | "GENERATE_QUESTIONS"
  | "GENERATE_FEEDBACK"
  | "GENERATE_STAGE_SUMMARY";

export type GuidedLearningResumeState =
  | "CREATED"
  | "ROUTE_LOCKED"
  | "QUESTIONS_GENERATING"
  | "ANSWER_SUBMITTED"
  | "QUESTION_COMPLETED"
  | "SUMMARY_GENERATING";

export type GuidedLearningFailure = {
  failure_id: string;
  failure_class: "RETRYABLE" | "PERMANENT";
  error_code:
    | "GENERATION_FAILED"
    | "TEMPORARY_UNAVAILABLE"
    | "INVALID_STATE"
    | "CONTRACT_REJECTED";
  message: string;
  attempt: number;
} & (
  | {
      failed_operation: "GENERATE_DIRECTIONS";
      resume_state: "CREATED";
    }
  | {
      failed_operation: "GENERATE_QUESTIONS";
      resume_state: "ROUTE_LOCKED" | "QUESTIONS_GENERATING";
    }
  | {
      failed_operation: "GENERATE_FEEDBACK";
      resume_state: "ANSWER_SUBMITTED";
    }
  | {
      failed_operation: "GENERATE_STAGE_SUMMARY";
      resume_state: "QUESTION_COMPLETED" | "SUMMARY_GENERATING";
    }
);

interface GuidedLearningSessionBase {
  session_id: string;
  project_id: string;
  document_version_id: string;
  mode: "GUIDED_LEARNING";
  learning_goal: string;
  session_revision: number;
  state_version: number;
  candidate_directions: GuidedLearningCandidateDirection[];
  selected_direction_id?: string;
  route?: GuidedLearningRoute;
  current_stage_id?: "UNDERSTAND";
  current_question_order?: number;
  questions?: GuidedLearningQuestion[];
  stage_summary?: GuidedLearningStageSummary;
  failure?: GuidedLearningFailure;
  created_at: string;
  updated_at: string;
}

export type GuidedLearningSession = GuidedLearningSessionBase &
  (
    | { state: "CREATED" }
    | { state: "AWAITING_DIRECTION_SELECTION" }
    | { state: "ROUTE_LOCKED" }
    | { state: "QUESTIONS_GENERATING" }
    | { state: "AWAITING_ANSWER" }
    | { state: "ANSWER_SUBMITTED" }
    | { state: "FEEDBACK_READY" }
    | { state: "QUESTION_COMPLETED" }
    | { state: "SUMMARY_GENERATING" }
    | { state: "STAGE_COMPLETED" }
    | { state: "SESSION_COMPLETED" }
    | { state: "RETRYABLE_FAILURE" }
    | { state: "FAILED" }
  );

export type GuidedLearningSelectDirectionPayload = {
  direction_id: string;
};
export type GuidedLearningStartStagePayload = { stage_id: "UNDERSTAND" };
export type GuidedLearningQuestionPointerPayload = {
  question_id: string;
  question_order: number;
};
export type GuidedLearningAnswerPayload =
  GuidedLearningQuestionPointerPayload & {
    answer: string;
  };
export type GuidedLearningSkipQuestionPayload =
  GuidedLearningQuestionPointerPayload & { reason: "I_DONT_KNOW" };
export type GuidedLearningRetryPayload = Record<string, never>;

interface GuidedLearningCommandBase {
  schema_version: typeof GUIDED_LEARNING_CONTRACT_VERSION;
  message_kind: "COMMAND";
  command_id: string;
  request_id: string;
  idempotency_key: string;
  session_id: string;
}

export type GuidedLearningCommand = GuidedLearningCommandBase &
  (
    | {
        command: "SELECT_DIRECTION";
        payload: GuidedLearningSelectDirectionPayload;
      }
    | { command: "START_STAGE"; payload: GuidedLearningStartStagePayload }
    | { command: "SUBMIT_ANSWER"; payload: GuidedLearningAnswerPayload }
    | { command: "SKIP_QUESTION"; payload: GuidedLearningSkipQuestionPayload }
    | {
        command: "CONFIRM_QUESTION";
        payload: GuidedLearningQuestionPointerPayload;
      }
    | { command: "EDIT_ANSWER"; payload: GuidedLearningAnswerPayload }
    | {
        command: "ADVANCE_QUESTION";
        payload: GuidedLearningQuestionPointerPayload;
      }
    | { command: "RETRY"; payload: GuidedLearningRetryPayload }
  );

export type GuidedLearningSessionEnvelope = {
  schema_version: typeof GUIDED_LEARNING_CONTRACT_VERSION;
  message_kind: "SESSION";
  session: GuidedLearningSession;
};

export type GuidedLearningContract =
  | GuidedLearningSessionEnvelope
  | GuidedLearningCommand;
export type GuidedLearningCommandName = GuidedLearningCommand["command"];
export type GuidedLearningEvent =
  | GuidedLearningCommandName
  | GuidedLearningServerEvent;

export const GUIDED_LEARNING_CLIENT_COMMANDS = [
  "SELECT_DIRECTION",
  "START_STAGE",
  "SUBMIT_ANSWER",
  "SKIP_QUESTION",
  "CONFIRM_QUESTION",
  "EDIT_ANSWER",
  "ADVANCE_QUESTION",
  "RETRY",
] as const satisfies readonly GuidedLearningCommandName[];

export type GuidedLearningServerEvent =
  | "DIRECTIONS_READY"
  | "QUESTIONS_READY"
  | "FEEDBACK_READY"
  | "SUMMARY_READY"
  | "COMPLETE_SESSION"
  | "RETRYABLE_FAILURE"
  | "PERMANENT_FAILURE";

export type GuidedLearningTransitionActor = "CLIENT" | "SERVER";
export interface GuidedLearningTransition {
  from: GuidedLearningState;
  event: GuidedLearningEvent;
  to: GuidedLearningState;
  actor: GuidedLearningTransitionActor;
}

const normalTransitions: readonly GuidedLearningTransition[] = [
  {
    from: "CREATED",
    event: "DIRECTIONS_READY",
    to: "AWAITING_DIRECTION_SELECTION",
    actor: "SERVER",
  },
  {
    from: "AWAITING_DIRECTION_SELECTION",
    event: "SELECT_DIRECTION",
    to: "ROUTE_LOCKED",
    actor: "CLIENT",
  },
  {
    from: "ROUTE_LOCKED",
    event: "START_STAGE",
    to: "QUESTIONS_GENERATING",
    actor: "CLIENT",
  },
  {
    from: "QUESTIONS_GENERATING",
    event: "QUESTIONS_READY",
    to: "AWAITING_ANSWER",
    actor: "SERVER",
  },
  {
    from: "AWAITING_ANSWER",
    event: "SUBMIT_ANSWER",
    to: "ANSWER_SUBMITTED",
    actor: "CLIENT",
  },
  {
    from: "AWAITING_ANSWER",
    event: "SKIP_QUESTION",
    to: "QUESTION_COMPLETED",
    actor: "CLIENT",
  },
  {
    from: "ANSWER_SUBMITTED",
    event: "FEEDBACK_READY",
    to: "FEEDBACK_READY",
    actor: "SERVER",
  },
  {
    from: "FEEDBACK_READY",
    event: "CONFIRM_QUESTION",
    to: "QUESTION_COMPLETED",
    actor: "CLIENT",
  },
  {
    from: "FEEDBACK_READY",
    event: "EDIT_ANSWER",
    to: "ANSWER_SUBMITTED",
    actor: "CLIENT",
  },
  {
    from: "QUESTION_COMPLETED",
    event: "EDIT_ANSWER",
    to: "ANSWER_SUBMITTED",
    actor: "CLIENT",
  },
  {
    from: "QUESTION_COMPLETED",
    event: "ADVANCE_QUESTION",
    to: "AWAITING_ANSWER",
    actor: "CLIENT",
  },
  {
    from: "QUESTION_COMPLETED",
    event: "ADVANCE_QUESTION",
    to: "SUMMARY_GENERATING",
    actor: "CLIENT",
  },
  {
    from: "SUMMARY_GENERATING",
    event: "SUMMARY_READY",
    to: "STAGE_COMPLETED",
    actor: "SERVER",
  },
  {
    from: "STAGE_COMPLETED",
    event: "COMPLETE_SESSION",
    to: "SESSION_COMPLETED",
    actor: "SERVER",
  },
];

const failureSourceStates: readonly GuidedLearningState[] = [
  "CREATED",
  "ROUTE_LOCKED",
  "QUESTIONS_GENERATING",
  "ANSWER_SUBMITTED",
  "QUESTION_COMPLETED",
  "SUMMARY_GENERATING",
];

export const GUIDED_LEARNING_TRANSITIONS: readonly GuidedLearningTransition[] =
  [
    ...normalTransitions,
    ...failureSourceStates.flatMap((from) => [
      {
        from,
        event: "RETRYABLE_FAILURE" as const,
        to: "RETRYABLE_FAILURE" as const,
        actor: "SERVER" as const,
      },
      {
        from,
        event: "PERMANENT_FAILURE" as const,
        to: "FAILED" as const,
        actor: "SERVER" as const,
      },
    ]),
    ...(
      [
        "CREATED",
        "ROUTE_LOCKED",
        "QUESTIONS_GENERATING",
        "ANSWER_SUBMITTED",
        "QUESTION_COMPLETED",
        "SUMMARY_GENERATING",
      ] as const
    ).map((to) => ({
      from: "RETRYABLE_FAILURE" as const,
      event: "RETRY" as const,
      to,
      actor: "CLIENT" as const,
    })),
  ];

export type GuidedLearningIdempotencyRecord = {
  idempotency_key: string;
  session_id: string;
  event: GuidedLearningEvent;
  request_fingerprint: string;
  from_state: GuidedLearningState;
  to_state: GuidedLearningState;
  actor: GuidedLearningTransitionActor;
  result_revision: number;
};

export type GuidedLearningTransitionResult =
  | {
      outcome: "APPLIED" | "IDEMPOTENT";
      from_state: GuidedLearningState;
      to_state: GuidedLearningState;
      actor: GuidedLearningTransitionActor;
      result_revision: number;
    }
  | {
      outcome: "REJECTED";
      from_state: GuidedLearningState;
      reason:
        | "IDEMPOTENCY_KEY_REQUIRED"
        | "IDEMPOTENCY_CONTEXT_REQUIRED"
        | "IDEMPOTENCY_KEY_REUSED"
        | "CURRENT_QUESTION_NOT_COMPLETE"
        | "REMAINING_QUESTION_CONTEXT_REQUIRED"
        | "FAILURE_CONTEXT_REQUIRED"
        | "FAILURE_RESUME_SHAPE_REQUIRED"
        | "INVALID_FAILURE_CONTEXT"
        | "INVALID_FAILURE_RESUME_STATE"
        | "EVIDENCE_CONFIRMATION_CONTEXT_REQUIRED"
        | "EVIDENCE_NOT_READY"
        | "ILLEGAL_TRANSITION";
    };

export interface ApplyGuidedLearningEventInput {
  state: GuidedLearningState;
  event: GuidedLearningEvent;
  idempotencyKey?: string;
  sessionId?: string;
  requestFingerprint?: string;
  idempotencyRecords?: readonly GuidedLearningIdempotencyRecord[];
  hasRemainingQuestions?: boolean;
  failureContext?: GuidedLearningFailure;
  /** Alias accepted for server adapters; never comes from a command payload. */
  failure?: GuidedLearningFailure;
  /** Server-computed confirmation context; never comes from COMMAND payload. */
  evidenceReady?: boolean;
  /** More explicit alias for server adapters; never comes from COMMAND payload. */
  canConfirmCurrentQuestion?: boolean;
  /** Set only after the caller has validated the complete failure Session shape. */
  resumeShapeValidated?: boolean;
  resultRevision?: number;
}

export function applyGuidedLearningEvent(
  input: ApplyGuidedLearningEventInput,
): GuidedLearningTransitionResult {
  const isClientEvent = GUIDED_LEARNING_CLIENT_COMMANDS.includes(
    input.event as GuidedLearningCommandName,
  );
  if (isClientEvent && !input.idempotencyKey)
    return rejected(input.state, "IDEMPOTENCY_KEY_REQUIRED");
  if (input.idempotencyKey && (!input.sessionId || !input.requestFingerprint))
    return rejected(input.state, "IDEMPOTENCY_CONTEXT_REQUIRED");

  const records = input.idempotencyRecords ?? [];
  if (input.idempotencyKey) {
    const prior = records.find(
      (record) => record.idempotency_key === input.idempotencyKey,
    );
    if (prior) {
      if (
        prior.session_id !== input.sessionId ||
        prior.event !== input.event ||
        prior.request_fingerprint !== input.requestFingerprint
      )
        return rejected(input.state, "IDEMPOTENCY_KEY_REUSED");
      return {
        outcome: "IDEMPOTENT",
        from_state: prior.from_state,
        to_state: prior.to_state,
        actor: prior.actor,
        result_revision: prior.result_revision,
      };
    }
  }

  if (input.event === "RETRY") {
    if (input.state !== "RETRYABLE_FAILURE")
      return rejected(input.state, "ILLEGAL_TRANSITION");
    const failure = input.failureContext ?? input.failure;
    if (!failure) return rejected(input.state, "FAILURE_CONTEXT_REQUIRED");
    if (input.resumeShapeValidated !== true)
      return rejected(input.state, "FAILURE_RESUME_SHAPE_REQUIRED");
    if (failure.failure_class !== "RETRYABLE")
      return rejected(input.state, "INVALID_FAILURE_CONTEXT");
    if (!isValidFailureResume(failure.failed_operation, failure.resume_state))
      return rejected(input.state, "INVALID_FAILURE_RESUME_STATE");
    return applied(input, failure.resume_state, "CLIENT");
  }

  if (
    input.event === "RETRYABLE_FAILURE" ||
    input.event === "PERMANENT_FAILURE"
  ) {
    if (!failureSourceStates.includes(input.state))
      return rejected(input.state, "ILLEGAL_TRANSITION");
    const failure = input.failureContext ?? input.failure;
    if (!failure) return rejected(input.state, "FAILURE_CONTEXT_REQUIRED");
    if (
      (input.event === "RETRYABLE_FAILURE" &&
        failure.failure_class !== "RETRYABLE") ||
      (input.event === "PERMANENT_FAILURE" &&
        failure.failure_class !== "PERMANENT")
    )
      return rejected(input.state, "INVALID_FAILURE_CONTEXT");
    if (
      failure.resume_state !== input.state ||
      !isValidFailureResume(failure.failed_operation, failure.resume_state)
    )
      return rejected(input.state, "INVALID_FAILURE_RESUME_STATE");
    return applied(
      input,
      input.event === "RETRYABLE_FAILURE" ? "RETRYABLE_FAILURE" : "FAILED",
      "SERVER",
    );
  }

  if (input.event === "ADVANCE_QUESTION") {
    if (input.state !== "QUESTION_COMPLETED")
      return rejected(input.state, "CURRENT_QUESTION_NOT_COMPLETE");
    if (typeof input.hasRemainingQuestions !== "boolean")
      return rejected(input.state, "REMAINING_QUESTION_CONTEXT_REQUIRED");
    return applied(
      input,
      input.hasRemainingQuestions ? "AWAITING_ANSWER" : "SUMMARY_GENERATING",
      "CLIENT",
    );
  }

  if (input.event === "CONFIRM_QUESTION" && input.state === "FEEDBACK_READY") {
    const evidenceReady =
      input.canConfirmCurrentQuestion ?? input.evidenceReady;
    if (evidenceReady === undefined)
      return rejected(input.state, "EVIDENCE_CONFIRMATION_CONTEXT_REQUIRED");
    if (evidenceReady !== true)
      return rejected(input.state, "EVIDENCE_NOT_READY");
  }

  const transition = normalTransitions.find(
    (candidate) =>
      candidate.from === input.state && candidate.event === input.event,
  );
  return transition
    ? applied(input, transition.to, transition.actor)
    : rejected(input.state, "ILLEGAL_TRANSITION");
}

function isValidFailureResume(
  operation: GuidedLearningFailureOperation,
  resumeState: GuidedLearningResumeState,
): boolean {
  return (
    (operation === "GENERATE_DIRECTIONS" && resumeState === "CREATED") ||
    (operation === "GENERATE_QUESTIONS" &&
      (resumeState === "ROUTE_LOCKED" ||
        resumeState === "QUESTIONS_GENERATING")) ||
    (operation === "GENERATE_FEEDBACK" && resumeState === "ANSWER_SUBMITTED") ||
    (operation === "GENERATE_STAGE_SUMMARY" &&
      (resumeState === "QUESTION_COMPLETED" ||
        resumeState === "SUMMARY_GENERATING"))
  );
}

function applied(
  input: ApplyGuidedLearningEventInput,
  to: GuidedLearningState,
  actor: GuidedLearningTransitionActor,
): GuidedLearningTransitionResult {
  return {
    outcome: "APPLIED",
    from_state: input.state,
    to_state: to,
    actor,
    result_revision: input.resultRevision ?? 1,
  };
}

function rejected(
  from: GuidedLearningState,
  reason: Extract<
    GuidedLearningTransitionResult,
    { outcome: "REJECTED" }
  >["reason"],
): GuidedLearningTransitionResult {
  return { outcome: "REJECTED", from_state: from, reason };
}

export function isCanonicalGuidedLearningRoute(
  route: GuidedLearningRoute,
): boolean {
  const [understand, analyze, transfer] = route.stages;
  return (
    route.locked === true &&
    route.route_version === "guided-route.v1" &&
    understand?.stage_id === "UNDERSTAND" &&
    understand.order === 1 &&
    understand.unlock_condition === "SESSION_DIRECTION_SELECTED" &&
    (understand.status === "OPEN" || understand.status === "COMPLETED") &&
    analyze?.stage_id === "ANALYZE" &&
    analyze.order === 2 &&
    analyze.status === "LOCKED" &&
    analyze.unlock_condition === "NOT_AVAILABLE_IN_V1" &&
    transfer?.stage_id === "TRANSFER" &&
    transfer.order === 3 &&
    transfer.status === "LOCKED" &&
    transfer.unlock_condition === "NOT_AVAILABLE_IN_V1"
  );
}

export const GUIDED_LEARNING_CONSISTENCY_ERROR_CODES = [
  "DUPLICATE_DIRECTION_ID",
  "SELECTED_DIRECTION_NOT_FOUND",
  "DIRECTION_SELECTION_STATE_MISMATCH",
  "NON_CANONICAL_ROUTE",
  "INVALID_CURRENT_STAGE",
  "QUESTION_ORDER_INVALID",
  "DUPLICATE_QUESTION_ORDER",
  "QUESTION_ORDER_NOT_CONTIGUOUS",
  "QUESTION_ARRAY_ORDER_MISMATCH",
  "DUPLICATE_QUESTION_ID",
  "QUESTION_STAGE_INVALID",
  "CURRENT_QUESTION_NOT_FOUND",
  "MULTIPLE_ACTIVE_QUESTIONS",
  "AWAITING_ANSWER_REQUIRES_ACTIVE_QUESTION",
  "CURRENT_QUESTION_POINTER_MISMATCH",
  "FUTURE_QUESTION_NOT_UNSEEN",
  "PREVIOUS_QUESTION_NOT_COMPLETED",
  "QUESTION_STATE_FIELDS_INVALID",
  "DUPLICATE_EVIDENCE_ID",
  "EVIDENCE_DOCUMENT_MISMATCH",
  "EVIDENCE_REFERENCE_NOT_FOUND",
  "EVIDENCE_NOT_VERIFIED",
  "EVIDENCE_REFERENCE_DUPLICATE",
  "INSUFFICIENT_EVIDENCE_REFERENCE_INVALID",
  "EVIDENCE_REQUIRED_FOR_SUPPORTED_CLAIM",
  "SUMMARY_REQUIRED",
  "SUMMARY_ORDERS_INVALID",
  "SUMMARY_ORDERS_OVERLAP",
  "SUMMARY_ORDERS_INCOMPLETE",
  "COMPLETION_REQUIRES_RESOLVED_QUESTIONS",
  "COMPLETION_REQUIRES_QUESTIONS",
  "FAILURE_STATE_MISMATCH",
  "FAILURE_NOT_ALLOWED",
  "FAILURE_RESUME_MISMATCH",
  "FAILURE_RESUME_SHAPE_INVALID",
  "RESUME_STATE_REQUIRED_FIELD_MISSING",
  "RESUME_STATE_FORBIDDEN_FIELD_PRESENT",
  "ROUTE_STAGE_STATUS_MISMATCH",
] as const;

export type GuidedLearningConsistencyErrorCode =
  (typeof GUIDED_LEARNING_CONSISTENCY_ERROR_CODES)[number];

export interface GuidedLearningConsistencyError {
  code: GuidedLearningConsistencyErrorCode;
  path?: string;
  message: string;
}

export interface GuidedLearningConsistencyResult {
  valid: boolean;
  errors: GuidedLearningConsistencyError[];
}

type UnknownRecord = Record<string, unknown>;

export function validateGuidedLearningSessionConsistency(
  session: GuidedLearningSession,
): GuidedLearningConsistencyResult {
  const value = session as unknown as UnknownRecord;
  const errors: GuidedLearningConsistencyError[] = [];
  const add = (
    code: GuidedLearningConsistencyErrorCode,
    message: string,
    path?: string,
  ) => errors.push({ code, message, ...(path ? { path } : {}) });
  const state = value.state;
  const failure = isRecord(value.failure) ? value.failure : undefined;
  const resumeState =
    state === "RETRYABLE_FAILURE" || state === "FAILED"
      ? failure?.resume_state
      : state;
  const selectionStates = new Set([
    "ROUTE_LOCKED",
    "QUESTIONS_GENERATING",
    "AWAITING_ANSWER",
    "ANSWER_SUBMITTED",
    "FEEDBACK_READY",
    "QUESTION_COMPLETED",
    "SUMMARY_GENERATING",
    "STAGE_COMPLETED",
    "SESSION_COMPLETED",
  ]);
  const questionStates = new Set([
    "AWAITING_ANSWER",
    "ANSWER_SUBMITTED",
    "FEEDBACK_READY",
    "QUESTION_COMPLETED",
    "SUMMARY_GENERATING",
    "STAGE_COMPLETED",
    "SESSION_COMPLETED",
  ]);
  const failureQuestionStates = new Set([
    "ANSWER_SUBMITTED",
    "QUESTION_COMPLETED",
    "SUMMARY_GENERATING",
  ]);

  const candidateDirections = Array.isArray(value.candidate_directions)
    ? value.candidate_directions
    : [];
  const directionIds = new Set<string>();
  candidateDirections.forEach((candidate, index) => {
    const id = isRecord(candidate) ? candidate.direction_id : undefined;
    if (typeof id === "string") {
      if (directionIds.has(id))
        add(
          "DUPLICATE_DIRECTION_ID",
          "candidate direction IDs must be unique",
          `candidate_directions[${index}].direction_id`,
        );
      directionIds.add(id);
    }
  });
  if (
    value.selected_direction_id !== undefined &&
    (typeof value.selected_direction_id !== "string" ||
      !directionIds.has(value.selected_direction_id))
  )
    add(
      "SELECTED_DIRECTION_NOT_FOUND",
      "selected_direction_id must reference candidate_directions",
      "selected_direction_id",
    );
  if (
    selectionStates.has(String(resumeState)) &&
    !directionIds.has(String(value.selected_direction_id))
  )
    add(
      "DIRECTION_SELECTION_STATE_MISMATCH",
      "this state requires a selected direction",
      "selected_direction_id",
    );
  if (
    (resumeState === "CREATED" ||
      resumeState === "AWAITING_DIRECTION_SELECTION") &&
    value.selected_direction_id !== undefined
  )
    add(
      "DIRECTION_SELECTION_STATE_MISMATCH",
      "direction cannot be selected before route locking",
      "selected_direction_id",
    );

  const routeRequired = selectionStates.has(String(resumeState));
  if (routeRequired && !isRecord(value.route))
    add("NON_CANONICAL_ROUTE", "route is required for this state", "route");
  if (routeRequired && isRecord(value.route)) {
    if (
      !isCanonicalGuidedLearningRoute(
        value.route as unknown as GuidedLearningRoute,
      )
    )
      add("NON_CANONICAL_ROUTE", "route must be the locked V1 route", "route");
    validateRouteStageStatus(
      value.route as UnknownRecord,
      String(resumeState),
      add,
    );
  }
  if (!routeRequired && value.route !== undefined)
    add(
      "NON_CANONICAL_ROUTE",
      "route cannot exist before direction selection",
      "route",
    );
  if (
    value.current_stage_id !== undefined &&
    value.current_stage_id !== "UNDERSTAND"
  )
    add(
      "INVALID_CURRENT_STAGE",
      "V1 only exposes the UNDERSTAND stage",
      "current_stage_id",
    );

  const questionsRequired =
    questionStates.has(String(resumeState)) ||
    ((state === "RETRYABLE_FAILURE" || state === "FAILED") &&
      failureQuestionStates.has(String(resumeState)));
  const questions = Array.isArray(value.questions)
    ? value.questions
    : undefined;
  if (questionsRequired && (!questions || questions.length === 0))
    add(
      "COMPLETION_REQUIRES_QUESTIONS",
      "this state requires questions",
      "questions",
    );

  const questionByOrder = new Map<number, UnknownRecord>();
  const questionIds = new Set<string>();
  const sessionEvidenceIds = new Map<string, string>();
  if (questions) {
    questions.forEach((question, index) => {
      if (!isRecord(question)) return;
      const order = question.order;
      const questionId = question.question_id;
      if (typeof order !== "number" || !Number.isInteger(order) || order < 1)
        add(
          "QUESTION_ORDER_INVALID",
          "question order must be a positive integer",
          `questions[${index}].order`,
        );
      else {
        if (questionByOrder.has(order))
          add(
            "DUPLICATE_QUESTION_ORDER",
            "question orders must be unique",
            `questions[${index}].order`,
          );
        questionByOrder.set(order, question);
      }
      if (typeof questionId === "string") {
        if (questionIds.has(questionId))
          add(
            "DUPLICATE_QUESTION_ID",
            "question IDs must be unique",
            `questions[${index}].question_id`,
          );
        questionIds.add(questionId);
      }
      if (question.stage_id !== "UNDERSTAND")
        add(
          "QUESTION_STAGE_INVALID",
          "all V1 questions belong to UNDERSTAND",
          `questions[${index}].stage_id`,
        );
      validateQuestionFields(question, add, `questions[${index}]`);
      if (
        question.status === "FEEDBACK_READY" ||
        question.status === "CONFIRMED"
      )
        validateQuestionEvidence(
          question,
          value.document_version_id,
          sessionEvidenceIds,
          add,
          `questions[${index}]`,
        );
    });
    const orders = questions.map((question) =>
      isRecord(question) ? question.order : undefined,
    );
    const validOrders = orders.every(
      (order): order is number =>
        typeof order === "number" && Number.isInteger(order),
    );
    if (validOrders) {
      orders.forEach((order, index) => {
        if (order !== index + 1)
          add(
            "QUESTION_ARRAY_ORDER_MISMATCH",
            "questions must be ordered by contiguous order",
            `questions[${index}].order`,
          );
      });
      for (let order = 1; order <= orders.length; order += 1) {
        if (!questionByOrder.has(order))
          add(
            "QUESTION_ORDER_NOT_CONTIGUOUS",
            "question orders must run from 1 without gaps",
            "questions",
          );
      }
    }
  }

  const activeQuestions =
    questions?.filter(
      (question) => isRecord(question) && question.status === "ACTIVE",
    ) ?? [];
  if (activeQuestions.length > 1)
    add(
      "MULTIPLE_ACTIVE_QUESTIONS",
      "at most one question may be ACTIVE",
      "questions",
    );

  const currentOrder = value.current_question_order;
  const currentQuestion =
    typeof currentOrder === "number"
      ? questionByOrder.get(currentOrder)
      : undefined;
  if (
    [
      "AWAITING_ANSWER",
      "ANSWER_SUBMITTED",
      "FEEDBACK_READY",
      "QUESTION_COMPLETED",
    ].includes(String(resumeState)) &&
    !currentQuestion
  )
    add(
      "CURRENT_QUESTION_NOT_FOUND",
      "current_question_order must reference a question",
      "current_question_order",
    );
  if (resumeState === "AWAITING_ANSWER") {
    if (activeQuestions.length !== 1)
      add(
        "AWAITING_ANSWER_REQUIRES_ACTIVE_QUESTION",
        "AWAITING_ANSWER requires exactly one ACTIVE question",
        "questions",
      );
    if (currentQuestion?.status !== "ACTIVE")
      add(
        "CURRENT_QUESTION_POINTER_MISMATCH",
        "current question must be the ACTIVE question",
        "current_question_order",
      );
  }
  if (
    resumeState === "ANSWER_SUBMITTED" &&
    currentQuestion?.status !== "ANSWERED"
  )
    add(
      "CURRENT_QUESTION_POINTER_MISMATCH",
      "ANSWER_SUBMITTED must point to an ANSWERED question",
      "current_question_order",
    );
  if (
    resumeState === "FEEDBACK_READY" &&
    currentQuestion?.status !== "FEEDBACK_READY"
  )
    add(
      "CURRENT_QUESTION_POINTER_MISMATCH",
      "FEEDBACK_READY must point to a FEEDBACK_READY question",
      "current_question_order",
    );
  if (
    resumeState === "QUESTION_COMPLETED" &&
    currentQuestion &&
    currentQuestion.status !== "CONFIRMED" &&
    currentQuestion.status !== "SKIPPED"
  )
    add(
      "CURRENT_QUESTION_POINTER_MISMATCH",
      "QUESTION_COMPLETED must point to a resolved question",
      "current_question_order",
    );
  if (
    ![
      "AWAITING_ANSWER",
      "ANSWER_SUBMITTED",
      "FEEDBACK_READY",
      "QUESTION_COMPLETED",
    ].includes(String(resumeState)) &&
    value.current_question_order !== undefined
  )
    add(
      "CURRENT_QUESTION_POINTER_MISMATCH",
      "current_question_order is only valid while processing a question",
      "current_question_order",
    );

  if (currentQuestion && typeof currentOrder === "number" && questions) {
    questions.forEach((question, index) => {
      if (!isRecord(question) || typeof question.order !== "number") return;
      if (question.order > currentOrder && question.status !== "UNSEEN")
        add(
          "FUTURE_QUESTION_NOT_UNSEEN",
          "questions after the current question must be UNSEEN",
          `questions[${index}].status`,
        );
      if (
        question.order < currentOrder &&
        ["UNSEEN", "ACTIVE", "ANSWERED", "FEEDBACK_READY"].includes(
          String(question.status),
        )
      )
        add(
          "PREVIOUS_QUESTION_NOT_COMPLETED",
          "questions before the current question must be resolved",
          `questions[${index}].status`,
        );
    });
  }

  const completionStates = new Set(["STAGE_COMPLETED", "SESSION_COMPLETED"]);
  const resolvedQuestionStates = new Set([
    "SUMMARY_GENERATING",
    "STAGE_COMPLETED",
    "SESSION_COMPLETED",
  ]);
  if (resolvedQuestionStates.has(String(resumeState))) {
    if (!questions || questions.length === 0)
      add(
        "COMPLETION_REQUIRES_QUESTIONS",
        "completion cannot contain an empty question set",
        "questions",
      );
    const unresolved =
      questions?.filter(
        (question) =>
          isRecord(question) &&
          !["CONFIRMED", "SKIPPED"].includes(String(question.status)),
      ) ?? [];
    if (unresolved.length > 0)
      add(
        "COMPLETION_REQUIRES_RESOLVED_QUESTIONS",
        "all questions must be CONFIRMED or SKIPPED",
        "questions",
      );
    if (
      completionStates.has(String(resumeState)) &&
      questions &&
      !isRecord(value.stage_summary)
    )
      add(
        "SUMMARY_REQUIRED",
        "completed states require stage_summary",
        "stage_summary",
      );
  }
  if (isRecord(value.stage_summary) && questions) {
    validateSummary(value.stage_summary, questions, add);
  } else if (
    value.stage_summary !== undefined &&
    !completionStates.has(String(resumeState))
  ) {
    add(
      "SUMMARY_REQUIRED",
      "stage_summary is only valid on completed states",
      "stage_summary",
    );
  }

  if (state === "RETRYABLE_FAILURE" || state === "FAILED") {
    if (!failure) {
      add(
        "FAILURE_STATE_MISMATCH",
        "failure states require a failure object",
        "failure",
      );
    } else {
      if (
        (state === "RETRYABLE_FAILURE" &&
          failure.failure_class !== "RETRYABLE") ||
        (state === "FAILED" && failure.failure_class !== "PERMANENT")
      )
        add(
          "FAILURE_STATE_MISMATCH",
          "failure_class must match the session state",
          "failure.failure_class",
        );
      if (
        !isValidFailureResume(
          failure.failed_operation as GuidedLearningFailureOperation,
          failure.resume_state as GuidedLearningResumeState,
        )
      )
        add(
          "FAILURE_RESUME_MISMATCH",
          "failed_operation and resume_state do not match",
          "failure.resume_state",
        );
    }
  } else if (failure) {
    add(
      "FAILURE_NOT_ALLOWED",
      "only failure states may contain failure",
      "failure",
    );
  }

  if (isGuidedLearningResumeState(resumeState))
    validateResumeStateShape(value, resumeState, add);

  return { valid: errors.length === 0, errors };
}

function validateRouteStageStatus(
  route: UnknownRecord,
  state: string,
  add: (
    code: GuidedLearningConsistencyErrorCode,
    message: string,
    path?: string,
  ) => void,
): void {
  const stages = Array.isArray(route.stages) ? route.stages : [];
  const understand = isRecord(stages[0]) ? stages[0] : undefined;
  const expectedStatus = ["STAGE_COMPLETED", "SESSION_COMPLETED"].includes(
    state,
  )
    ? "COMPLETED"
    : "OPEN";
  if (understand?.status !== expectedStatus)
    add(
      "ROUTE_STAGE_STATUS_MISMATCH",
      `UNDERSTAND must be ${expectedStatus} for this state`,
      "route.stages[0].status",
    );
}

function validateQuestionEvidence(
  question: UnknownRecord,
  sessionDocumentVersionId: unknown,
  sessionEvidenceIds: Map<string, string>,
  add: (
    code: GuidedLearningConsistencyErrorCode,
    message: string,
    path?: string,
  ) => void,
  path: string,
): void {
  const evidence = Array.isArray(question.evidence)
    ? question.evidence.filter(isRecord)
    : [];
  const evidenceById = new Map<string, UnknownRecord>();
  for (const [index, span] of evidence.entries()) {
    const evidenceId = span.evidence_span_id;
    if (typeof evidenceId !== "string") continue;
    if (evidenceById.has(evidenceId) || sessionEvidenceIds.has(evidenceId))
      add(
        "DUPLICATE_EVIDENCE_ID",
        "evidence_span_id values must be unique within a session",
        `${path}.evidence[${index}].evidence_span_id`,
      );
    else {
      evidenceById.set(evidenceId, span);
      sessionEvidenceIds.set(
        evidenceId,
        `${path}.evidence[${index}].evidence_span_id`,
      );
    }
    if (span.document_version_id !== sessionDocumentVersionId)
      add(
        "EVIDENCE_DOCUMENT_MISMATCH",
        "Evidence must belong to the Session document version",
        `${path}.evidence[${index}].document_version_id`,
      );
    if (span.verification_status !== "VERIFIED")
      add(
        "EVIDENCE_NOT_VERIFIED",
        "FEEDBACK_READY and CONFIRMED require VERIFIED Evidence",
        `${path}.evidence[${index}].verification_status`,
      );
  }

  const referenceAnswer = isRecord(question.reference_answer)
    ? question.reference_answer
    : undefined;
  const claims =
    referenceAnswer && Array.isArray(referenceAnswer.claims)
      ? referenceAnswer.claims.filter(isRecord)
      : [];
  for (const [claimIndex, claim] of claims.entries()) {
    const refs = Array.isArray(claim.evidence_refs)
      ? claim.evidence_refs.filter(
          (ref): ref is string => typeof ref === "string",
        )
      : [];
    if (claim.claim_type === "INSUFFICIENT_EVIDENCE") {
      if (refs.length > 0)
        add(
          "INSUFFICIENT_EVIDENCE_REFERENCE_INVALID",
          "INSUFFICIENT_EVIDENCE claims cannot cite Evidence",
          `${path}.reference_answer.claims[${claimIndex}].evidence_refs`,
        );
      continue;
    }
    if (
      claim.claim_type === "PAPER_FACT" ||
      claim.claim_type === "AUTHOR_CLAIM" ||
      claim.claim_type === "AGENT_INFERENCE"
    ) {
      if (refs.length === 0)
        add(
          "EVIDENCE_REQUIRED_FOR_SUPPORTED_CLAIM",
          "supported claims must cite at least one Evidence span",
          `${path}.reference_answer.claims[${claimIndex}].evidence_refs`,
        );
      const seenRefs = new Set<string>();
      for (const [refIndex, ref] of refs.entries()) {
        if (seenRefs.has(ref))
          add(
            "EVIDENCE_REFERENCE_DUPLICATE",
            "a claim cannot cite the same Evidence span twice",
            `${path}.reference_answer.claims[${claimIndex}].evidence_refs[${refIndex}]`,
          );
        seenRefs.add(ref);
        const citedEvidence = evidenceById.get(ref);
        if (!citedEvidence) {
          add(
            "EVIDENCE_REFERENCE_NOT_FOUND",
            "claim evidence_ref must reference an Evidence span in the question",
            `${path}.reference_answer.claims[${claimIndex}].evidence_refs[${refIndex}]`,
          );
        } else if (citedEvidence.verification_status !== "VERIFIED") {
          add(
            "EVIDENCE_NOT_VERIFIED",
            "supported claims may cite only VERIFIED Evidence",
            `${path}.reference_answer.claims[${claimIndex}].evidence_refs[${refIndex}]`,
          );
        }
      }
    }
  }
}

function validateResumeStateShape(
  session: UnknownRecord,
  resumeState: GuidedLearningResumeState,
  add: (
    code: GuidedLearningConsistencyErrorCode,
    message: string,
    path?: string,
  ) => void,
): void {
  const has = (key: string) => Object.hasOwn(session, key);
  const required = (condition: boolean, key: string) => {
    if (!condition)
      add(
        "RESUME_STATE_REQUIRED_FIELD_MISSING",
        `${resumeState} requires ${key}`,
        key,
      );
  };
  const forbidden = (key: string) => {
    if (has(key))
      add(
        "RESUME_STATE_FORBIDDEN_FIELD_PRESENT",
        `${resumeState} must not contain ${key}`,
        key,
      );
  };
  const questions = Array.isArray(session.questions)
    ? session.questions.filter(isRecord)
    : [];
  const currentOrder = session.current_question_order;
  const currentQuestion =
    typeof currentOrder === "number"
      ? questions.find((question) => question.order === currentOrder)
      : undefined;

  switch (resumeState) {
    case "CREATED":
      if (
        !Array.isArray(session.candidate_directions) ||
        session.candidate_directions.length !== 0
      )
        add(
          "FAILURE_RESUME_SHAPE_INVALID",
          "CREATED resume state must have empty candidate_directions",
          "candidate_directions",
        );
      for (const key of [
        "selected_direction_id",
        "route",
        "current_stage_id",
        "current_question_order",
        "questions",
        "stage_summary",
      ])
        forbidden(key);
      break;
    case "ROUTE_LOCKED":
    case "QUESTIONS_GENERATING":
      required(
        Array.isArray(session.candidate_directions) &&
          session.candidate_directions.length > 0,
        "candidate_directions",
      );
      required(
        typeof session.selected_direction_id === "string",
        "selected_direction_id",
      );
      required(
        isRecord(session.route) &&
          isCanonicalGuidedLearningRoute(
            session.route as unknown as GuidedLearningRoute,
          ),
        "canonical route",
      );
      required(session.current_stage_id === "UNDERSTAND", "current_stage_id");
      for (const key of [
        "questions",
        "current_question_order",
        "stage_summary",
      ])
        forbidden(key);
      break;
    case "ANSWER_SUBMITTED":
      required(
        typeof session.selected_direction_id === "string",
        "selected_direction_id",
      );
      required(
        isRecord(session.route) &&
          isCanonicalGuidedLearningRoute(
            session.route as unknown as GuidedLearningRoute,
          ),
        "canonical route",
      );
      required(session.current_stage_id === "UNDERSTAND", "current_stage_id");
      required(questions.length > 0, "questions");
      required(typeof currentOrder === "number", "current_question_order");
      required(
        currentQuestion?.status === "ANSWERED",
        "current ANSWERED question",
      );
      if (currentQuestion) {
        required(
          typeof currentQuestion.user_answer === "string",
          "user_answer",
        );
        for (const key of [
          "feedback",
          "reference_answer",
          "evidence",
          "skip_reason",
        ])
          if (Object.hasOwn(currentQuestion, key))
            add(
              "RESUME_STATE_FORBIDDEN_FIELD_PRESENT",
              `ANSWER_SUBMITTED current question must not contain ${key}`,
              `questions[${currentOrder}].${key}`,
            );
      }
      break;
    case "QUESTION_COMPLETED":
      required(
        typeof session.selected_direction_id === "string",
        "selected_direction_id",
      );
      required(
        isRecord(session.route) &&
          isCanonicalGuidedLearningRoute(
            session.route as unknown as GuidedLearningRoute,
          ),
        "canonical route",
      );
      required(session.current_stage_id === "UNDERSTAND", "current_stage_id");
      required(questions.length > 0, "questions");
      required(typeof currentOrder === "number", "current_question_order");
      required(
        currentQuestion?.status === "CONFIRMED" ||
          currentQuestion?.status === "SKIPPED",
        "resolved current question",
      );
      break;
    case "SUMMARY_GENERATING":
      required(
        typeof session.selected_direction_id === "string",
        "selected_direction_id",
      );
      required(
        isRecord(session.route) &&
          isCanonicalGuidedLearningRoute(
            session.route as unknown as GuidedLearningRoute,
          ),
        "canonical route",
      );
      required(session.current_stage_id === "UNDERSTAND", "current_stage_id");
      required(questions.length > 0, "questions");
      if (
        questions.some(
          (question) =>
            !["CONFIRMED", "SKIPPED"].includes(String(question.status)),
        )
      )
        add(
          "COMPLETION_REQUIRES_RESOLVED_QUESTIONS",
          "SUMMARY_GENERATING requires every question to be CONFIRMED or SKIPPED",
          "questions",
        );
      forbidden("current_question_order");
      forbidden("stage_summary");
      break;
  }
}

function isGuidedLearningResumeState(
  value: unknown,
): value is GuidedLearningResumeState {
  return (
    typeof value === "string" &&
    [
      "CREATED",
      "ROUTE_LOCKED",
      "QUESTIONS_GENERATING",
      "ANSWER_SUBMITTED",
      "QUESTION_COMPLETED",
      "SUMMARY_GENERATING",
    ].includes(value)
  );
}

function validateQuestionFields(
  question: UnknownRecord,
  add: (
    code: GuidedLearningConsistencyErrorCode,
    message: string,
    path?: string,
  ) => void,
  path: string,
): void {
  const has = (key: string) => Object.hasOwn(question, key);
  const status = question.status;
  if (status === "UNSEEN" || status === "ACTIVE") {
    if (
      has("user_answer") ||
      has("skip_reason") ||
      has("feedback") ||
      has("reference_answer") ||
      has("evidence")
    )
      add(
        "QUESTION_STATE_FIELDS_INVALID",
        "unanswered questions cannot contain answer or feedback fields",
        path,
      );
  } else if (status === "ANSWERED") {
    if (
      typeof question.user_answer !== "string" ||
      has("skip_reason") ||
      has("feedback") ||
      has("reference_answer") ||
      has("evidence")
    )
      add(
        "QUESTION_STATE_FIELDS_INVALID",
        "ANSWERED questions only contain user_answer",
        path,
      );
  } else if (status === "SKIPPED") {
    if (
      question.confirmation_status !== "SKIPPED" ||
      question.skip_reason !== "I_DONT_KNOW" ||
      has("user_answer") ||
      has("feedback") ||
      has("reference_answer") ||
      has("evidence")
    )
      add(
        "QUESTION_STATE_FIELDS_INVALID",
        "SKIPPED questions cannot contain answer or feedback fields",
        path,
      );
  } else if (status === "FEEDBACK_READY" || status === "CONFIRMED") {
    if (
      typeof question.user_answer !== "string" ||
      !has("feedback") ||
      !has("reference_answer") ||
      !Array.isArray(question.evidence) ||
      question.evidence.length === 0 ||
      has("skip_reason")
    )
      add(
        "QUESTION_STATE_FIELDS_INVALID",
        "feedback states require answer, feedback, reference answer and evidence",
        path,
      );
    if (status === "CONFIRMED" && question.confirmation_status !== "CONFIRMED")
      add(
        "QUESTION_STATE_FIELDS_INVALID",
        "CONFIRMED questions require CONFIRMED confirmation_status",
        path,
      );
  }
}

function validateSummary(
  summary: UnknownRecord,
  questions: unknown[],
  add: (
    code: GuidedLearningConsistencyErrorCode,
    message: string,
    path?: string,
  ) => void,
): void {
  const completed = asIntegerArray(summary.completed_question_orders);
  const skipped = asIntegerArray(summary.skipped_question_orders);
  if (!completed || !skipped) {
    add(
      "SUMMARY_ORDERS_INVALID",
      "summary question orders must be integer arrays",
      "stage_summary",
    );
    return;
  }
  const completedSet = new Set(completed);
  const skippedSet = new Set(skipped);
  if (
    completedSet.size !== completed.length ||
    skippedSet.size !== skipped.length
  )
    add(
      "SUMMARY_ORDERS_INVALID",
      "summary question orders must be unique",
      "stage_summary",
    );
  if (completed.some((order) => skippedSet.has(order)))
    add(
      "SUMMARY_ORDERS_OVERLAP",
      "completed and skipped question orders cannot overlap",
      "stage_summary",
    );
  const recordQuestions = questions.filter(isRecord);
  const expectedCompleted = recordQuestions
    .filter((question) => question.status === "CONFIRMED")
    .map((question) => question.order)
    .filter((order): order is number => typeof order === "number");
  const expectedSkipped = recordQuestions
    .filter((question) => question.status === "SKIPPED")
    .map((question) => question.order)
    .filter((order): order is number => typeof order === "number");
  if (
    !sameNumberSet(completedSet, expectedCompleted) ||
    !sameNumberSet(skippedSet, expectedSkipped)
  )
    add(
      "SUMMARY_ORDERS_INVALID",
      "summary does not match question statuses",
      "stage_summary",
    );
  const allOrders = new Set(
    questions
      .map((question) => (isRecord(question) ? question.order : undefined))
      .filter((order): order is number => typeof order === "number"),
  );
  if (!sameNumberSet(new Set([...completedSet, ...skippedSet]), allOrders))
    add(
      "SUMMARY_ORDERS_INCOMPLETE",
      "summary must cover every question exactly once",
      "stage_summary",
    );
}

function sameNumberSet(
  actual: Set<number>,
  expected: number[] | Set<number>,
): boolean {
  const expectedSet = expected instanceof Set ? expected : new Set(expected);
  return (
    actual.size === expectedSet.size &&
    [...actual].every((value) => expectedSet.has(value))
  );
}

function asIntegerArray(value: unknown): number[] | undefined {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item))
    ? (value as number[])
    : undefined;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
