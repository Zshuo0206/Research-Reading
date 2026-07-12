import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
if (rootFlag >= 0 && !args[rootFlag + 1])
  throw new Error("--root requires a directory");
const root = path.resolve(rootFlag >= 0 ? args[rootFlag + 1] : process.cwd());
const skipAudit = args.includes("--skip-audit");
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".cache",
]);
const ignoredFiles = new Set(["package-lock.json"]);
const ignoredAuditPath = path.join(
  "docs",
  "audits",
  "wave1-integration",
  "review-bundle",
);
const allFiles = [];

const visit = (absolute) => {
  const relative = path.relative(root, absolute);
  const base = path.basename(absolute);
  if (
    ignoredDirectories.has(base) ||
    relative === ignoredAuditPath ||
    relative.startsWith(`${ignoredAuditPath}${path.sep}`)
  ) {
    return;
  }
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(absolute))
      visit(path.join(absolute, child));
    return;
  }
  allFiles.push(absolute);
};
visit(root);

const relativePath = (file) =>
  path.relative(root, file).split(path.sep).join("/");
const isTextFile = (file) =>
  /\.(mjs|ts|tsx|js|jsx|json|md|yaml|yml|toml|env|example|txt|html|css)$/i.test(
    file,
  );
const isAllowedEnvTemplate = (base) =>
  base === ".env.example" || base === ".env.template";
const isEnvFile = (base) => base === ".env" || base.startsWith(".env.");
const textFiles = allFiles.filter(
  (file) => !ignoredFiles.has(path.basename(file)) && isTextFile(file),
);

const rules = [
  ["OpenAI-style key", /sk-[A-Za-z0-9]{20,}/g],
  ["Google-style key", /AIza[A-Za-z0-9_-]{20,}/g],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["bearer token", /authorization\s*[:=]\s*bearer\s+[A-Za-z0-9._-]{12,}/gi],
  [
    "API key assignment",
    /(?:api[_-]?key|MODEL_API_KEY)\s*[:=]\s*["']?[A-Za-z0-9_-]{12,}/gi,
  ],
];
const findings = [];
for (const file of textFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const [type, rule] of rules) {
    const match = rule.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push({ file: relativePath(file), line, type });
    }
    rule.lastIndex = 0;
  }
}

const printForbidden = (file, reason) => {
  console.error(`[security] forbidden ${reason} ${relativePath(file)}`);
  process.exitCode = 1;
};

for (const file of allFiles) {
  const base = path.basename(file);
  if (isEnvFile(base) && !isAllowedEnvTemplate(base))
    printForbidden(file, "environment file");
  if (/\.(sqlite|sqlite3|db)$/i.test(base))
    printForbidden(file, "database file");
  if (/\.(pem|key|p12|pfx)$/i.test(base))
    printForbidden(file, "private-key file");
}

const pdfFixtureDirectory = path.join(root, "tests", "fixtures", "pdf");
const pdfManifestPath = path.join(pdfFixtureDirectory, "manifest.json");
const isWithin = (child, parent) => {
  const relative = path.relative(parent, child);
  return (
    relative &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
};
const loadPdfManifest = () => {
  if (!fs.existsSync(pdfManifestPath))
    throw new Error(
      "missing PDF fixture manifest tests/fixtures/pdf/manifest.json",
    );
  const manifest = JSON.parse(fs.readFileSync(pdfManifestPath, "utf8"));
  if (
    manifest.manifest_version !== "pdf-fixture-manifest.v1" ||
    !Array.isArray(manifest.fixtures)
  )
    throw new Error("invalid PDF fixture manifest");
  return manifest;
};
const isRedistributableFixture = (entry) =>
  typeof entry.source === "string" &&
  entry.source.length > 0 &&
  typeof entry.sha256 === "string" &&
  /^[a-f0-9]{64}$/i.test(entry.sha256) &&
  typeof entry.license?.spdx_id === "string" &&
  entry.license.spdx_id.length > 0 &&
  entry.license.redistribution_allowed === true &&
  ["SYNTHETIC", "CC0", "REDISTRIBUTABLE"].includes(
    entry.license.redistribution_class,
  );
const pdfFiles = allFiles.filter((file) => /\.pdf$/i.test(file));
let pdfManifest;
try {
  pdfManifest = loadPdfManifest();
} catch (error) {
  console.error(`[security] ${error.message}`);
  process.exitCode = 1;
  pdfManifest = { fixtures: [] };
}
for (const file of pdfFiles) {
  if (!isWithin(file, pdfFixtureDirectory)) {
    printForbidden(file, "PDF outside tests/fixtures/pdf");
    continue;
  }
  const fixturePath = relativePath(file);
  const entry = pdfManifest.fixtures.find(
    (candidate) => candidate.fixture_path === fixturePath,
  );
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
  if (!entry || !isRedistributableFixture(entry) || entry.sha256 !== hash)
    printForbidden(file, "unregistered or unlicensed PDF fixture");
}

for (const finding of findings) {
  console.error(
    `[security] suspected ${finding.type} at ${finding.file}:${finding.line}`,
  );
  process.exitCode = 1;
}

if (!skipAudit) {
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
  );
  const licenseAllowlist = new Set([
    "MIT",
    "ISC",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "0BSD",
    "CC0-1.0",
    "CC-BY-4.0",
    "Python-2.0",
  ]);
  for (const packagePath of Object.keys(lock.packages ?? {}).filter((name) =>
    name.startsWith("node_modules/"),
  )) {
    const packageFile = path.join(root, packagePath, "package.json");
    if (!fs.existsSync(packageFile)) continue;
    const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    const licenses = Array.isArray(pkg.licenses)
      ? pkg.licenses.map((entry) => entry.type)
      : [pkg.license];
    const allowed = licenses.some((license) =>
      String(license)
        .split(/\s+(?:OR|AND)\s+/)
        .some((part) => licenseAllowlist.has(part)),
    );
    if (!allowed) {
      console.error(
        `[security] unapproved dependency license ${pkg.name}: ${licenses.join(", ")}`,
      );
      process.exitCode = 1;
    }
  }
  const audit = spawnSync(
    process.platform === "win32" ? "cmd.exe" : "npm",
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm audit --audit-level=high --omit=optional"]
      : ["audit", "--audit-level=high", "--omit=optional"],
    { cwd: root, stdio: "inherit" },
  );
  if (audit.error || audit.status !== 0) process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(
    `[security] enumerated ${allFiles.length} files and scanned ${textFiles.length} text files; environment, PDF fixture, database, private-key, secret, dependency/license and audit checks completed${skipAudit ? " (audit skipped for scanner self-test)" : ""}`,
  );
}
