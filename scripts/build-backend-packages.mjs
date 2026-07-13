import { cpSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const tsc = resolve(root, "node_modules/typescript/bin/tsc");

const run = (project) => {
  execFileSync(process.execPath, [tsc, "-p", project], {
    cwd: root,
    stdio: "inherit",
  });
};

run("packages/contracts/tsconfig.json");
cpSync(
  resolve(root, "packages/contracts/wave1/generated"),
  resolve(root, "packages/contracts/dist/wave1/generated"),
  { recursive: true, force: true },
);
run("packages/storage/tsconfig.json");
run("packages/runtime-secrets/tsconfig.json");
run("packages/model-gateway/tsconfig.json");
