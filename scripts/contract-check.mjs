import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const committed = path.join(
  root,
  "packages",
  "contracts",
  "wave1",
  "generated",
);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "wave1-contract-check-"));
try {
  const result = spawnSync(
    process.execPath,
    ["scripts/contract-generate.mjs", "--out", temp],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(`${result.stdout}\n${result.stderr}`);
  const expected = fs.existsSync(committed)
    ? fs
        .readdirSync(committed)
        .filter((name) => name.endsWith(".d.ts"))
        .sort()
    : [];
  const actual = fs
    .readdirSync(temp)
    .filter((name) => name.endsWith(".d.ts"))
    .sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error(
      `generated file set differs: expected ${expected.join(",")}, actual ${actual.join(",")}`,
    );
  for (const name of expected) {
    const left = fs.readFileSync(path.join(committed, name), "utf8");
    const right = fs.readFileSync(path.join(temp, name), "utf8");
    if (left !== right) throw new Error(`generated contract drift: ${name}`);
  }
  console.log(
    `[contract-check] generated ${actual.length} deterministic TypeScript files with no drift`,
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
