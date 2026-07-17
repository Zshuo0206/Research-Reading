import type {
  ModelGatewayEnvelope,
  RuntimeSecretRef,
} from "../../packages/contracts/wave1/src/index.js";

export function inspectSecret(secret: RuntimeSecretRef): string {
  if (secret.kind === "SESSION_MEMORY") return secret.handle;
  return secret.name;
}

export function inspectGatewayMessage(message: ModelGatewayEnvelope): string {
  if (message.message_kind === "REQUEST") {
    // @ts-expect-error Requests never expose response output.
    void message.output;
    switch (message.operation) {
      case "GENERATE_QUESTION_PLAN":
        return message.input.document_language;
      case "GENERATE_ANSWER":
        return message.input.confirmed_question.text;
      case "CONNECTION_TEST":
        return String(message.input.probe);
      case "GENERATE_GUIDED_DIRECTIONS":
      case "GENERATE_GUIDED_QUESTIONS":
      case "GENERATE_GUIDED_FEEDBACK":
      case "GENERATE_GUIDED_STAGE_SUMMARY":
        return message.input.learning_goal;
      default: {
        const unreachable: never = message;
        return unreachable;
      }
    }
  }

  // @ts-expect-error Responses never expose request input.
  void message.input;
  switch (message.operation) {
    case "GENERATE_QUESTION_PLAN": {
      const questionText: string = message.output.questions[0].text;
      return questionText;
    }
    case "GENERATE_ANSWER":
      return message.output.claims[0].text;
    case "CONNECTION_TEST":
      return message.output.success
        ? message.output.model
        : message.output.error_category;
    case "GENERATE_GUIDED_DIRECTIONS":
      return message.output.directions[0].title;
    case "GENERATE_GUIDED_QUESTIONS":
      return message.output.questions[0].text;
    case "GENERATE_GUIDED_FEEDBACK":
      return message.output.summary;
    case "GENERATE_GUIDED_STAGE_SUMMARY":
      return message.output.next_stage_hint;
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
}
