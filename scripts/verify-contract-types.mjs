import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "packages", "contracts", "wave1", "src", "index.ts"),
  "utf8",
);
const generatedGateway = fs.readFileSync(
  path.join(
    root,
    "packages",
    "contracts",
    "wave1",
    "generated",
    "model-gateway.v1.d.ts",
  ),
  "utf8",
);
const expected = [
  "api.v1",
  "document.v1",
  "job.v1",
  "question-plan.v1",
  "answer.v1",
  "evidence.v1",
  "model-gateway.v1",
];
for (const version of expected) {
  if (!source.includes(version))
    throw new Error(`TypeScript contract surface is missing ${version}`);
}
for (const symbol of [
  "ModelProviderConfig",
  "QuestionPlan",
  "Answer",
  "EvidenceSpan",
  "Job",
  "canTransitionJob",
]) {
  if (!new RegExp(`\\b${symbol}\\b`).test(source))
    throw new Error(`TypeScript contract surface is missing ${symbol}`);
}
if (/api[_-]?key|secret\s*:/i.test(source))
  throw new Error(
    "TypeScript persisted config surface contains a secret field",
  );
if (!source.includes("Wave1ModelGatewayRequestResponseContract"))
  throw new Error(
    "TypeScript surface does not import the generated gateway union",
  );
if (
  /interface\s+ModelGateway|type\s+ModelGatewayEnvelope\s*=\s*\{/.test(source)
)
  throw new Error("ModelGateway interfaces must not be manually duplicated");
for (const expected of [
  'message_kind: "REQUEST"',
  'message_kind: "RESPONSE"',
  'operation: "GENERATE_QUESTION_PLAN"',
  "questions:",
  "text: string",
]) {
  if (!generatedGateway.includes(expected))
    throw new Error(`generated gateway type is missing ${expected}`);
}
if (generatedGateway.includes("[k: string]: unknown"))
  throw new Error("generated gateway type contains an unknown object fallback");
console.log(
  "[contract-types] generated request/response union, typed question draft and secret boundary verified",
);
