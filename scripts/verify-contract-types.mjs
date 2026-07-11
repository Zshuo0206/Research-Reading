import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, "packages", "contracts", "wave1", "src", "index.ts"),
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
console.log(
  "[contract-types] TypeScript contract surface covers all wave1.v1 schema versions and secret boundary",
);
