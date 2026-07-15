import type { Wave1GuidedLearningSessionAndStateMachine } from "../generated/guided-learning.v1.d.ts";

export type GuidedLearningContract = Wave1GuidedLearningSessionAndStateMachine;
export type GuidedLearningSession = Extract<
  GuidedLearningContract,
  { message_kind: "SESSION" }
>["session"];
export type GuidedLearningCommand = Extract<
  GuidedLearningContract,
  { message_kind: "COMMAND" }
>;
export type GuidedLearningState = GuidedLearningSession["state"];
export type GuidedLearningCommandName = GuidedLearningCommand["command"];
export type GuidedLearningQuestion = NonNullable<
  GuidedLearningSession["questions"]
>[number];
export type GuidedLearningRoute = NonNullable<GuidedLearningSession["route"]>;

export const GUIDED_LEARNING_CONTRACT_VERSION = "guided-learning.v1" as const;

export const GUIDED_LEARNING_STATES = [
  "CREATED",
  "DIRECTIONS_READY",
  "AWAITING_DIRECTION_SELECTION",
  "ROUTE_LOCKED",
  "STAGE_IN_PROGRESS",
  "AWAITING_ANSWER",
  "ANSWER_SUBMITTED",
  "FEEDBACK_READY",
  "QUESTION_COMPLETED",
  "STAGE_COMPLETED",
  "SESSION_COMPLETED",
  "RETRYABLE_FAILURE",
  "FAILED",
] as const satisfies readonly GuidedLearningState[];

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
  | "RETRYABLE_FAILURE"
  | "PERMANENT_FAILURE";
export type GuidedLearningEvent =
  | GuidedLearningCommandName
  | GuidedLearningServerEvent;

export type GuidedLearningTransitionActor = "CLIENT" | "SERVER";
export interface GuidedLearningTransition {
  from: GuidedLearningState;
  event: GuidedLearningEvent;
  to: GuidedLearningState;
  actor: GuidedLearningTransitionActor;
}

export const GUIDED_LEARNING_TRANSITIONS: readonly GuidedLearningTransition[] =
  [
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
      to: "STAGE_IN_PROGRESS",
      actor: "CLIENT",
    },
    {
      from: "STAGE_IN_PROGRESS",
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
      from: "AWAITING_ANSWER",
      event: "SKIP_QUESTION",
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
      to: "STAGE_COMPLETED",
      actor: "CLIENT",
    },
    {
      from: "STAGE_COMPLETED",
      event: "SUMMARY_READY",
      to: "SESSION_COMPLETED",
      actor: "SERVER",
    },
    {
      from: "RETRYABLE_FAILURE",
      event: "RETRY",
      to: "STAGE_IN_PROGRESS",
      actor: "CLIENT",
    },
  ];

const failureSourceStates: readonly GuidedLearningState[] = [
  "CREATED",
  "DIRECTIONS_READY",
  "AWAITING_DIRECTION_SELECTION",
  "ROUTE_LOCKED",
  "STAGE_IN_PROGRESS",
  "AWAITING_ANSWER",
  "ANSWER_SUBMITTED",
  "FEEDBACK_READY",
  "QUESTION_COMPLETED",
  "STAGE_COMPLETED",
];

export interface GuidedLearningIdempotencyRecord {
  idempotency_key: string;
  event: GuidedLearningEvent;
  to_state: GuidedLearningState;
}

export type GuidedLearningTransitionResult =
  | {
      outcome: "APPLIED" | "IDEMPOTENT";
      from_state: GuidedLearningState;
      to_state: GuidedLearningState;
      actor: GuidedLearningTransitionActor;
    }
  | {
      outcome: "REJECTED";
      from_state: GuidedLearningState;
      reason:
        | "IDEMPOTENCY_KEY_REQUIRED"
        | "IDEMPOTENCY_KEY_REUSED"
        | "CURRENT_QUESTION_NOT_COMPLETE"
        | "REMAINING_QUESTION_CONTEXT_REQUIRED"
        | "ILLEGAL_TRANSITION";
    };

export function applyGuidedLearningEvent(input: {
  state: GuidedLearningState;
  event: GuidedLearningEvent;
  idempotencyKey?: string;
  idempotencyRecords?: readonly GuidedLearningIdempotencyRecord[];
  hasRemainingQuestions?: boolean;
}): GuidedLearningTransitionResult {
  const isClientEvent = GUIDED_LEARNING_CLIENT_COMMANDS.includes(
    input.event as GuidedLearningCommandName,
  );
  const records = input.idempotencyRecords ?? [];
  if (isClientEvent && !input.idempotencyKey)
    return {
      outcome: "REJECTED",
      from_state: input.state,
      reason: "IDEMPOTENCY_KEY_REQUIRED",
    };
  if (input.idempotencyKey) {
    const prior = records.find(
      (record) => record.idempotency_key === input.idempotencyKey,
    );
    if (prior) {
      if (prior.event !== input.event)
        return {
          outcome: "REJECTED",
          from_state: input.state,
          reason: "IDEMPOTENCY_KEY_REUSED",
        };
      return {
        outcome: "IDEMPOTENT",
        from_state: input.state,
        to_state: prior.to_state,
        actor: "CLIENT",
      };
    }
  }

  if (input.event === "RETRYABLE_FAILURE")
    return failureTransition(input, "RETRYABLE_FAILURE");
  if (input.event === "PERMANENT_FAILURE")
    return failureTransition(input, "FAILED");

  if (input.event === "ADVANCE_QUESTION") {
    if (input.state !== "QUESTION_COMPLETED")
      return rejected(input.state, "CURRENT_QUESTION_NOT_COMPLETE");
    if (typeof input.hasRemainingQuestions !== "boolean")
      return rejected(input.state, "REMAINING_QUESTION_CONTEXT_REQUIRED");
    return applied(
      input.state,
      input.hasRemainingQuestions ? "AWAITING_ANSWER" : "STAGE_COMPLETED",
      "CLIENT",
    );
  }

  const transition = GUIDED_LEARNING_TRANSITIONS.find(
    (candidate) =>
      candidate.from === input.state && candidate.event === input.event,
  );
  return transition
    ? applied(input.state, transition.to, transition.actor)
    : rejected(input.state, "ILLEGAL_TRANSITION");
}

export function isCanonicalGuidedLearningRoute(
  route: GuidedLearningRoute,
): boolean {
  const [understand, analyze, transfer] = route.stages;
  return (
    route.locked === true &&
    route.route_version === "guided-route.v1" &&
    understand.stage_id === "UNDERSTAND" &&
    understand.order === 1 &&
    understand.unlock_condition === "SESSION_DIRECTION_SELECTED" &&
    analyze.stage_id === "ANALYZE" &&
    analyze.order === 2 &&
    analyze.status === "LOCKED" &&
    analyze.unlock_condition === "NOT_AVAILABLE_IN_V1" &&
    transfer.stage_id === "TRANSFER" &&
    transfer.order === 3 &&
    transfer.status === "LOCKED" &&
    transfer.unlock_condition === "NOT_AVAILABLE_IN_V1"
  );
}

function failureTransition(
  input: { state: GuidedLearningState },
  to: Extract<GuidedLearningState, "RETRYABLE_FAILURE" | "FAILED">,
): GuidedLearningTransitionResult {
  return failureSourceStates.includes(input.state)
    ? applied(input.state, to, "SERVER")
    : rejected(input.state, "ILLEGAL_TRANSITION");
}

function applied(
  from: GuidedLearningState,
  to: GuidedLearningState,
  actor: GuidedLearningTransitionActor,
): GuidedLearningTransitionResult {
  return { outcome: "APPLIED", from_state: from, to_state: to, actor };
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
