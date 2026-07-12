import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const probeDirectory = path.join(root, "tests", ".security-scan-probe");
if (fs.existsSync(probeDirectory))
  throw new Error(`security probe directory already exists: ${probeDirectory}`);

const probes = [".env", "paper.pdf", "state.sqlite", "private.key"];
try {
  fs.mkdirSync(probeDirectory, { recursive: true });
  for (const name of probes) {
    const probe = path.join(probeDirectory, name);
    fs.writeFileSync(probe, "scanner-probe\n");
    const result = spawnSync(
      process.execPath,
      ["scripts/security-scan.mjs", "--skip-audit"],
      { cwd: root, encoding: "utf8" },
    );
    if (
      result.status === 0 ||
      !result.stderr.includes(path.join("tests", ".security-scan-probe", name))
    ) {
      throw new Error(`security scanner did not reject ${name}`);
    }
    fs.rmSync(probe);
  }
  console.log(
    `[security-test] rejected ${probes.length} temporary forbidden files and cleaned each probe`,
  );
} finally {
  fs.rmSync(probeDirectory, { recursive: true, force: true });
}
