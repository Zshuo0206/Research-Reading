import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const dir = path.join(root, "tests", "fixtures", "evaluation");
const schema = JSON.parse(
  fs.readFileSync(path.join(dir, "manifest.v1.schema.json"), "utf8"),
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(dir, "manifest.json"), "utf8"),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);
const valid = ajv.compile(schema)(manifest);
if (!valid)
  throw new Error(`evaluation manifest invalid: ${JSON.stringify(ajv.errors)}`);
for (const sample of manifest.samples) {
  if (!/^[a-f0-9]{64}$/.test(sample.sha256))
    throw new Error(`${sample.sample_id}: invalid SHA-256`);
  if (/\.pdf$/i.test(sample.fixture_path ?? ""))
    throw new Error(`${sample.sample_id}: paper PDFs must not be committed`);
  if (/api[_-]?key|token|bearer|private key/i.test(JSON.stringify(sample)))
    throw new Error(`${sample.sample_id}: secret-like fixture content`);
}
console.log(
  `[evaluation] validated ${manifest.samples.length} metadata-only samples; no paper PDF fixture is committed`,
);
