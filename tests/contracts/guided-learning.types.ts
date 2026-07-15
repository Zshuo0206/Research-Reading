import type {
  ContractVersion,
  GuidedLearningCommand,
  GuidedLearningContract,
  SupportedContractVersion,
} from "../../packages/contracts/wave1/src/index.js";

const submitAnswer = {
  schema_version: "guided-learning.v1",
  message_kind: "COMMAND",
  command_id: "guided_cmd_types_1",
  request_id: "req_types_1",
  idempotency_key: "idem_types_1",
  session_id: "learning_types_1",
  command: "SUBMIT_ANSWER",
  payload: {
    question_id: "guided_question_1",
    question_order: 1,
    answer: "答案",
  },
} satisfies GuidedLearningCommand;

const selectDirection = {
  ...submitAnswer,
  command: "SELECT_DIRECTION",
  payload: { direction_id: "direction_method" },
} satisfies GuidedLearningCommand;

const sessionMessage = {
  schema_version: "guided-learning.v1",
  message_kind: "SESSION",
  session: {
    session_id: "learning_types_1",
    project_id: "proj_types_1",
    document_version_id: "docv_types_1",
    mode: "GUIDED_LEARNING",
    learning_goal: "goal",
    state: "CREATED",
    session_revision: 1,
    state_version: 1,
    candidate_directions: [],
    created_at: "2026-07-15T00:00:00Z",
    updated_at: "2026-07-15T00:00:00Z",
  },
} satisfies GuidedLearningContract;

void submitAnswer;
void selectDirection;
void sessionMessage;

const commandWithState: GuidedLearningCommand = {
  schema_version: "guided-learning.v1",
  message_kind: "COMMAND",
  command_id: "guided_cmd_types_2",
  request_id: "req_types_2",
  idempotency_key: "idem_types_2",
  session_id: "learning_types_2",
  command: "RETRY",
  payload: {},
  // @ts-expect-error server-owned state is not a command envelope field.
  state: "ANSWER_SUBMITTED",
};

const payloadWithRoute: GuidedLearningCommand = {
  ...submitAnswer,
  // @ts-expect-error route is server-owned and cannot be added to a command payload.
  payload: { ...submitAnswer.payload, route: {} },
};

const payloadWithVerification: GuidedLearningCommand = {
  ...submitAnswer,
  // @ts-expect-error verification status is server-owned.
  payload: { ...submitAnswer.payload, verification_status: "VERIFIED" },
};

// @ts-expect-error a SESSION envelope cannot be assigned to a command.
const commandFromSession: Extract<
  GuidedLearningContract,
  { message_kind: "COMMAND" }
> = sessionMessage;

const directionWithStage: GuidedLearningCommand = {
  ...selectDirection,
  // @ts-expect-error SELECT_DIRECTION does not accept a stage_id.
  payload: { direction_id: "direction_method", stage_id: "UNDERSTAND" },
};

const answerWithSkipReason: GuidedLearningCommand = {
  ...submitAnswer,
  // @ts-expect-error SUBMIT_ANSWER does not accept skip_reason.
  payload: { ...submitAnswer.payload, skip_reason: "I_DONT_KNOW" },
};

const oldVersion: ContractVersion = "api.v1";
const guidedVersion: SupportedContractVersion = "guided-learning.v1";
void oldVersion;
void guidedVersion;

// @ts-expect-error guided-learning.v1 is intentionally not part of ContractVersion.
const oldVersionCannotBeGuided: ContractVersion = "guided-learning.v1";

// @ts-expect-error unsupported versions are rejected.
const unsupportedVersion: SupportedContractVersion = "unknown.v1";

void commandWithState;
void payloadWithRoute;
void payloadWithVerification;
void commandFromSession;
void directionWithStage;
void answerWithSkipReason;
void oldVersionCannotBeGuided;
void unsupportedVersion;
