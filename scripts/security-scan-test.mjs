import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const probeDirectory = path.join(root, "tests", ".security-scan-probe");
const pdfDirectory = path.join(root, "tests", "fixtures", "pdf");
const manifestPath = path.join(pdfDirectory, "manifest.json");
const probePdf = path.join(pdfDirectory, "security-scan-probe.pdf");
if (fs.existsSync(probeDirectory) || fs.existsSync(probePdf))
  throw new Error("security scanner probe path already exists");

const originalManifest = fs.readFileSync(manifestPath);
const runScanner = () =>
  spawnSync(process.execPath, ["scripts/security-scan.mjs", "--skip-audit"], {
    cwd: root,
    encoding: "utf8",
  });
const expectRejected = (label) => {
  const result = runScanner();
  if (result.status === 0)
    throw new Error(`security scanner did not reject ${label}`);
};
const writeManifest = (fixtures) =>
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ manifest_version: "pdf-fixture-manifest.v1", fixtures }, null, 2)}\n`,
  );

try {
  fs.mkdirSync(probeDirectory, { recursive: true });
  for (const name of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test",
    "state.sqlite",
    "private.key",
    "private.txt",
    "paper.pdf",
  ]) {
    const probe = path.join(probeDirectory, name);
    fs.writeFileSync(
      probe,
      name === "private.txt"
        ? ["-----BEGIN", "PRIVATE KEY-----", "scanner-probe", ""].join(" ")
        : "scanner-probe\n",
    );
    expectRejected(name);
    fs.rmSync(probe);
  }
  for (const name of [".env.example", ".env.template"]) {
    const probe = path.join(probeDirectory, name);
    fs.writeFileSync(probe, "MODEL_API_KEY=placeholder\n");
    const result = runScanner();
    if (result.status !== 0)
      throw new Error(
        `security scanner did not allow ${name}: ${result.stderr}`,
      );
    fs.rmSync(probe);
  }

  fs.writeFileSync(probePdf, "%PDF-1.4\nsynthetic scanner probe\n");
  expectRejected("unregistered in-directory PDF fixture");
  const fixturePath = "tests/fixtures/pdf/security-scan-probe.pdf";
  const sha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(probePdf))
    .digest("hex");
  writeManifest([
    {
      fixture_path: fixturePath,
      sha256: "0".repeat(64),
      source: "generated for scanner test",
      license: {
        spdx_id: "CC0-1.0",
        redistribution_allowed: true,
        redistribution_class: "SYNTHETIC",
      },
    },
  ]);
  expectRejected("PDF fixture with mismatched hash");
  writeManifest([
    {
      fixture_path: fixturePath,
      sha256,
      source: "generated for scanner test",
      license: { spdx_id: "CC0-1.0", redistribution_allowed: false },
    },
  ]);
  expectRejected("PDF fixture without redistributable license");
  writeManifest([
    {
      fixture_path: fixturePath,
      sha256,
      source: "generated for scanner test",
      license: {
        spdx_id: "CC0-1.0",
        redistribution_allowed: true,
        redistribution_class: "SYNTHETIC",
      },
    },
  ]);
  const validResult = runScanner();
  if (validResult.status !== 0)
    throw new Error(
      `security scanner rejected valid synthetic PDF: ${validResult.stderr}`,
    );
  console.log(
    "[security-test] rejected environment, database, private-key and invalid PDF probes; accepted only a registered synthetic PDF fixture",
  );
} finally {
  fs.rmSync(probeDirectory, { recursive: true, force: true });
  fs.rmSync(probePdf, { force: true });
  fs.writeFileSync(manifestPath, originalManifest);
}
