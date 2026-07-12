import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const skipAudit = process.argv.includes("--skip-audit");
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

const textExtensions =
  /\.(mjs|ts|tsx|js|jsx|json|md|yaml|yml|toml|env|example|txt|html|css|pem|key)$/i;
const textFiles = allFiles.filter(
  (file) => !ignoredFiles.has(path.basename(file)) && textExtensions.test(file),
);
const forbiddenFiles = allFiles.filter((file) => {
  const base = path.basename(file);
  return (
    base === ".env" ||
    /\.(pdf|sqlite|sqlite3|db)$/i.test(base) ||
    /\.(pem|key|p12|pfx)$/i.test(base)
  );
});

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
      findings.push({ file: path.relative(root, file), line, type });
    }
    rule.lastIndex = 0;
  }
}

for (const file of forbiddenFiles) {
  console.error(
    `[security] forbidden file ${path.relative(root, file)} (${path.basename(file)})`,
  );
  process.exitCode = 1;
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
    `[security] enumerated ${allFiles.length} files and scanned ${textFiles.length} text files; forbidden file, secret, dependency/license and audit checks completed${skipAudit ? " (audit skipped for scanner self-test)" : ""}`,
  );
}
