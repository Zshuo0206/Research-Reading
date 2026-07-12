import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const required = [
  "AGENTS.md",
  "docs/CURRENT_STATE.md",
  "apps/web/index.html",
  "apps/api/src/server.ts",
  "apps/api/src/host-policy.ts",
  "apps/api/package.json",
  "apps/worker/package.json",
  "apps/web/package.json",
  "apps/web/host-policy.ts",
  "apps/web/vite.config.ts",
  "packages/contracts/package.json",
  "apps/worker/src/worker.ts",
  "compose.yaml",
  "infra/Dockerfile",
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
  for (const obsolete of [
    "apps/api/src/server.mjs",
    "apps/worker/src/worker.mjs",
    "apps/api/Dockerfile",
    "apps/worker/Dockerfile",
    "docker-compose.yml",
  ]) {
    if (fs.existsSync(path.join(root, obsolete)))
      fail(`obsolete duplicate platform shell exists: ${obsolete}`);
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
  const build = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      "apps/api/tsconfig.json",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (build.error || build.status !== 0)
    throw new Error("formal TypeScript/Fastify API shell failed to build");
  const port = 4311;
  const child = spawn(process.execPath, ["apps/api/dist/server.js"], {
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
