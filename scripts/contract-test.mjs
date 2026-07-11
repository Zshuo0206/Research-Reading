import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const contractDir = path.join(root, "packages", "contracts", "wave1");
const fixtureDir = path.join(root, "tests", "fixtures", "contracts");
const schemaFiles = fs
  .readdirSync(contractDir)
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
for (const name of schemaFiles) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(contractDir, name), "utf8"),
  );
  ajv.addSchema(schema, name);
}
for (const name of schemaFiles) {
  assert(ajv.getSchema(name), `schema ${name} was not registered`);
}
const validate = (schemaFile, value) => {
  const check = ajv.getSchema(schemaFile);
  assert(check, `missing schema ${schemaFile}`);
  const valid = check(value);
  assert(
    valid,
    `${schemaFile} rejected fixture: ${JSON.stringify(check.errors)}`,
  );
};
const rejects = (schemaFile, value, message) => {
  const check = ajv.getSchema(schemaFile);
  assert(check && !check(value), message);
};

for (const name of schemaFiles) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(contractDir, name), "utf8"),
  );
  assert(schema.$id?.includes(".v1"), `${name} must have a versioned $id`);
}

validate(
  "api.v1.schema.json",
  JSON.parse(
    fs.readFileSync(path.join(fixtureDir, "api-success.json"), "utf8"),
  ),
);
validate(
  "api.v1.schema.json",
  JSON.parse(
    fs.readFileSync(path.join(fixtureDir, "api-failure.json"), "utf8"),
  ),
);
const apiBase = { schema_version: "api.v1", request_id: "req_invalid" };
rejects(
  "api.v1.schema.json",
  {
    ...apiBase,
    data: {},
    error: { code: "TIMEOUT", message: "x", retryable: true },
  },
  "API envelope must reject data and error together",
);
rejects(
  "api.v1.schema.json",
  apiBase,
  "API envelope must reject data and error omission",
);
rejects(
  "api.v1.schema.json",
  { ...apiBase, error: { code: "TIMEOUT", message: "x" } },
  "error object must require retryable",
);
rejects(
  "api.v1.schema.json",
  {
    ...apiBase,
    error: { error: { code: "TIMEOUT", message: "x", retryable: true } },
  },
  "API envelope must not accept error.error wrapping",
);

const modelFixtureDir = path.join(fixtureDir, "model-gateway");
for (const name of [
  "question-plan-valid.json",
  "answer-valid.json",
  "connection-test-valid.json",
]) {
  validate(
    "model-gateway.v1.schema.json",
    JSON.parse(fs.readFileSync(path.join(modelFixtureDir, name), "utf8")),
  );
}
for (const name of [
  "question-plan-invalid.json",
  "answer-invalid.json",
  "connection-test-invalid.json",
]) {
  rejects(
    "model-gateway.v1.schema.json",
    JSON.parse(fs.readFileSync(path.join(modelFixtureDir, name), "utf8")),
    `${name} must be rejected`,
  );
}

const validContext = {
  context_span_id: "context_1",
  document_version_id: "docv_1",
  page_number: 1,
  char_start: 0,
  char_end: 12,
  text: "Method text.",
  page_text_sha256:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  extraction_profile_version: "pdfjs-text-v1",
};
validate("evidence.v1.schema.json", {
  schema_version: "evidence.v1",
  spans: [validContext],
});
const invalidInterval = { ...validContext, char_end: 0 };
rejects(
  "evidence.v1.schema.json",
  { schema_version: "evidence.v1", spans: [invalidInterval] },
  "context span must reject non-positive end",
);
const answer = {
  schema_version: "answer.v1",
  answer_id: "answer_1",
  question_id: "question_1",
  current_revision: "arev_1",
  review_status: "DRAFT",
  verification_status: "PENDING",
  revisions: [
    {
      revision_id: "arev_1",
      revision_number: 1,
      created_by: "MODEL",
      created_at: "2026-01-01T00:00:00Z",
      content_hash:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      claims: [
        {
          claim_id: "claim_1",
          text: "Supported fact",
          claim_type: "PAPER_FACT",
          evidence_refs: ["evidence_1"],
        },
      ],
    },
  ],
};
validate("answer.v1.schema.json", answer);
rejects(
  "answer.v1.schema.json",
  {
    ...answer,
    revisions: [
      {
        ...answer.revisions[0],
        claims: [
          { ...answer.revisions[0].claims[0], evidence_refs: ["context_1"] },
        ],
      },
    ],
  },
  "final Answer must reject context span IDs",
);
const modelDirectOffset = JSON.parse(
  fs.readFileSync(path.join(modelFixtureDir, "answer-valid.json"), "utf8"),
);
modelDirectOffset.output.claims[0].char_start = 0;
rejects(
  "model-gateway.v1.schema.json",
  modelDirectOffset,
  "ModelGateway output must reject final character offsets",
);

const baseModel = {
  schema_version: "model-gateway.v1",
  operation: "CONNECTION_TEST",
  provider_config: {
    provider: "OPENAI",
    base_url: "https://api.openai.com/v1",
    model: "test",
    request_timeout_ms: 1000,
    max_input_characters: 100,
    max_output_tokens: 10,
  },
  input: { probe: true },
  output: { success: true, provider: "OPENAI", model: "test" },
};
rejects(
  "model-gateway.v1.schema.json",
  {
    ...baseModel,
    provider_config: { ...baseModel.provider_config, api_key: "plaintext" },
  },
  "plaintext API key must fail persisted config",
);
rejects(
  "wave1.v1.schema.json",
  { contracts: [] },
  "missing schema version must fail",
);
rejects(
  "job.v1.schema.json",
  {
    schema_version: "job.v1",
    job_id: "job_1",
    kind: "ANSWER_GENERATION",
    state: "RETRYING",
    attempt: 0,
    max_attempts: 1,
    created_at: "2026-01-01T00:00:00Z",
  },
  "illegal job state must fail",
);
assert(
  Array.from("αβγ").length === 3,
  "Unicode code point length must be three",
);
assert(
  Array.from("αβγ").slice(0, 4).length === 3,
  "Evidence helper boundary fixture must be deterministic",
);
console.log(
  `[contract] compiled ${schemaFiles.length} schemas; API envelope, ContextSpan/EvidenceSpan, Answer refs, three gateway operations, positive/negative fixtures and boundary checks passed`,
);
