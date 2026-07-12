import type { ModelGatewayEnvelope } from "../../packages/contracts/wave1/src/index.js";

export function inspectGatewayMessage(message: ModelGatewayEnvelope): string {
  if (message.message_kind === "REQUEST") {
    // @ts-expect-error Requests never expose response output.
    void message.output;
    switch (message.operation) {
      case "GENERATE_QUESTION_PLAN":
        return message.input.document_language;
      case "GENERATE_ANSWER":
        return message.input.confirmed_question_revision;
      case "CONNECTION_TEST":
        return String(message.input.probe);
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
    default: {
      const unreachable: never = message;
      return unreachable;
    }
  }
}
