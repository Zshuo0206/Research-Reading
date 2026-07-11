import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const required = [
  "AGENTS.md",
  "docs/CURRENT_STATE.md",
  "apps/web/index.html",
  "apps/api/src/server.mjs",
  "apps/api/src/server.ts",
  "apps/api/package.json",
  "apps/worker/package.json",
  "apps/web/package.json",
  "packages/contracts/package.json",
  "apps/worker/src/worker.mjs",
  "packages/contracts/wave0.schema.json",
  "docs/templates/task.yaml",
];

const fail = (message) => {
  console.error(`[check] ${message}`);
  process.exitCode = 1;
};

const assertFiles = () => {
  for (const relative of required) {
    if (!fs.existsSync(path.join(root, relative)))
      fail(`missing required file: ${relative}`);
  }
};

const checkJson = (relative) => {
  try {
    JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  } catch (error) {
    fail(`invalid JSON ${relative}: ${error.message}`);
  }
};

const checkWave0Boundaries = () => {
  const forbidden = [
    "apps/api/src/pdf",
    "apps/api/src/model",
    "apps/api/src/evidence",
    "apps/api/src/export",
  ];
  for (const relative of forbidden) {
    if (fs.existsSync(path.join(root, relative)))
      fail(`Wave 0 boundary violated: ${relative}`);
  }
};

const runHealth = async () => {
  const port = 4311;
  const child = spawn(process.execPath, ["apps/api/src/server.mjs"], {
    cwd: root,
    env: { ...process.env, API_PORT: String(port), API_HOST: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    let response;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (!response)
      throw new Error(`health endpoint did not start; output=${output}`);
    const body = await response.json();
    if (
      response.status !== 200 ||
      body.status !== "ok" ||
      body.wave !== 1 ||
      body.schema_version !== "api.v1"
    ) {
      throw new Error(`unexpected health response: ${JSON.stringify(body)}`);
    }
  } finally {
    child.kill("SIGTERM");
  }
};

const mode = process.argv[2] ?? "all";
assertFiles();
checkJson("package.json");
checkJson("packages/contracts/wave0.schema.json");
checkWave0Boundaries();

if (mode === "all") await import("./check-wave1-planning.mjs");

if (mode === "test" || mode === "all") await runHealth();
if (
  ["format", "lint", "typecheck", "build", "security", "all"].includes(mode)
) {
  // Tool-specific gates are owned by the root npm scripts; this command checks shell and planning invariants.
  console.log(`[check] ${mode}: structural gate passed`);
}
console.log(`[check] ${mode}: passed`);
