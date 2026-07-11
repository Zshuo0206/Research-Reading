import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".cache",
]);
const ignoredFiles = new Set(["package-lock.json", "manifest.v1.schema.json"]);
const textExtensions =
  /\.(mjs|ts|tsx|js|jsx|json|md|yaml|yml|toml|env|example|txt|html|css)$/i;
const files = [];
const visit = (absolute) => {
  const base = path.basename(absolute);
  if (
    ignoredDirectories.has(base) ||
    absolute.includes(
      path.join("docs", "audits", "wave1-integration", "review-bundle"),
    )
  )
    return;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(absolute))
      visit(path.join(absolute, child));
  } else if (!ignoredFiles.has(base) && textExtensions.test(absolute)) {
    files.push(absolute);
  }
};
visit(root);

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
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const [type, rule] of rules) {
    const match = rule.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push({ file: path.relative(root, file), line, type });
    }
    rule.lastIndex = 0;
  }
}
const git = spawnSync(
  process.platform === "win32" ? "git.exe" : "git",
  ["ls-files"],
  { cwd: root, encoding: "utf8" },
);
const trackedEnv = (git.stdout ?? "")
  .split(/\r?\n/)
  .filter((file) => /(^|[\\/])\.env$/i.test(file));
const sqlite = files.filter((file) => /\.(sqlite|sqlite3|db)$/i.test(file));
const pdf = files.filter((file) => /\.pdf$/i.test(file));
if (findings.length) {
  for (const finding of findings)
    console.error(
      `[security] suspected ${finding.type} at ${finding.file}:${finding.line}`,
    );
  process.exitCode = 1;
}
if (trackedEnv.length) {
  console.error(
    `[security] tracked actual .env files: ${trackedEnv.join(", ")}`,
  );
  process.exitCode = 1;
}
if (sqlite.length) {
  console.error(
    `[security] database files found: ${sqlite.map((file) => path.relative(root, file)).join(", ")}`,
  );
  process.exitCode = 1;
}
if (pdf.length) {
  console.error(
    `[security] PDF files found: ${pdf.map((file) => path.relative(root, file)).join(", ")}`,
  );
  process.exitCode = 1;
}
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
if (!process.exitCode)
  console.log(
    `[security] scanned ${files.length} text files; no secret, tracked .env, SQLite or PDF findings; dependency/license and npm audit checks completed`,
  );
