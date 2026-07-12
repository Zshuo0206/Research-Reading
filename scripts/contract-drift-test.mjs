import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const sourceSchemaDir = path.join(root, "packages", "contracts", "wave1");
const committedGenerated = path.join(
  sourceSchemaDir,
  "generated",
  "model-gateway.v1.d.ts",
);
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "research-reading-contract-drift-"),
);

try {
  const temporarySchemaDir = path.join(temporaryRoot, "schemas");
  const temporaryOutputDir = path.join(temporaryRoot, "generated");
  fs.cpSync(sourceSchemaDir, temporarySchemaDir, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}generated`),
  });
  const modelSchemaPath = path.join(
    temporarySchemaDir,
    "model-gateway.v1.schema.json",
  );
  const modelSchema = JSON.parse(fs.readFileSync(modelSchemaPath, "utf8"));
  modelSchema.$defs.question_plan_draft.properties.drift_probe = {
    type: "string",
  };
  fs.writeFileSync(
    modelSchemaPath,
    `${JSON.stringify(modelSchema, null, 2)}\n`,
  );

  const generated = spawnSync(
    process.execPath,
    [
      "scripts/contract-generate.mjs",
      "--schema-dir",
      temporarySchemaDir,
      "--out",
      temporaryOutputDir,
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (generated.error || generated.status !== 0) {
    throw new Error(
      `drift probe generation failed: ${generated.stderr || generated.error}`,
    );
  }
  const baseline = fs.readFileSync(committedGenerated, "utf8");
  const probe = fs.readFileSync(
    path.join(temporaryOutputDir, "model-gateway.v1.d.ts"),
    "utf8",
  );
  if (baseline === probe) {
    throw new Error("contract drift probe was not detected");
  }
  console.log(
    "[contract-drift] schema mutation changed generated TypeScript as expected",
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
