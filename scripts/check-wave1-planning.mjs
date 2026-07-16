import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const taskDirectory = path.join(root, "docs", "tasks", "backlog");
const taskFiles = fs
  .readdirSync(taskDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^T-W1-.*\.yaml$/.test(entry.name))
  .map((entry) => path.join(taskDirectory, entry.name))
  .sort();

const required = [
  "docs/architecture/wave1-technical-plan.md",
  "docs/audits/wave1-technical-startup-summary.md",
  "docs/rfcs/RFC-W1-001-technical-foundation-and-contract-baseline.md",
  "docs/CURRENT_STATE.md",
  "docs/integration/ownership-map.yaml",
];
const errors = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative)))
    errors.push(`missing required planning file: ${relative}`);
}
if (
  fs.existsSync(
    path.join(
      root,
      "docs/tasks/backlog/T-W1-003-document-storage-and-pdf-ingest.yaml",
    ),
  )
) {
  errors.push(
    "stale unsplit task file exists: T-W1-003-document-storage-and-pdf-ingest.yaml",
  );
}

const plan = read("docs/architecture/wave1-technical-plan.md");
const startup = read("docs/audits/wave1-technical-startup-summary.md");
const rfc = read(
  "docs/rfcs/RFC-W1-001-technical-foundation-and-contract-baseline.md",
);
const state = read("docs/CURRENT_STATE.md");
const allDocs = `${plan}\n${startup}\n${rfc}\n${state}`;
const requiredTerms = [
  "Node.js 24",
  "Gate A",
  "Gate B",
  "Gate C",
  "127.0.0.1",
  "canonical_page_text",
  "context_span_id",
  "document_language",
  "retrieval_queries",
  "retrieval_terms",
  "review_status",
  "verification_status",
  "PR Playwright smoke",
  "qa-evaluation-agent",
];
for (const term of requiredTerms) {
  if (!allDocs.includes(term)) errors.push(`missing consistency term: ${term}`);
}
for (const forbidden of ["Node 22 LTS期限已结束", "Node 22 单仓库"]) {
  if (allDocs.includes(forbidden))
    errors.push(`forbidden stale wording: ${forbidden}`);
}
if (!rfc.includes("- Status: `REPAIR_PENDING_REVIEW`"))
  errors.push("RFC-W1-001 repair status is not pending independent review");
if (!startup.includes("Gate B 编码授权：`GRANTED`"))
  errors.push("startup summary does not record first-batch Gate B GRANTED");
if (!startup.includes("Gate C 业务任务解锁：`LOCKED`"))
  errors.push("startup summary does not keep Gate C locked after repair");

const tasks = new Map();
for (const file of taskFiles) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (error) {
    errors.push(
      `task file cannot be read: ${path.basename(file)} (${error instanceof Error ? error.message : String(error)})`,
    );
    continue;
  }
  const id = content.match(/^task_id:\s*(\S+)/m)?.[1];
  if (!id) {
    errors.push(`task has no task_id: ${path.basename(file)}`);
    continue;
  }
  if (
    !/^status:\s*(DRAFT|READY|ASSIGNED|IN_PROGRESS|REVIEW|ACCEPTED|INTEGRATED|DONE|PARTIAL|BLOCKED|REJECTED|CANCELLED)\s*$/m.test(
      content,
    )
  )
    errors.push(`${id} has an invalid lifecycle status`);
  const dependencyBlock =
    content.match(/^dependencies:\n([\s\S]*?)\n\nwritable_paths:/m)?.[1] ?? "";
  const deps = [...dependencyBlock.matchAll(/^\s+- task_id:\s*(\S+)/gm)].map(
    (match) => match[1],
  );
  tasks.set(id, { file, deps });
}

for (const [id, task] of tasks) {
  for (const dep of task.deps)
    if (/^T-W1-/.test(dep) && !tasks.has(dep))
      errors.push(`${id} depends on missing task ${dep}`);
}
const visiting = new Set();
const visited = new Set();
const visit = (id, trail = []) => {
  if (visiting.has(id)) {
    errors.push(`dependency cycle: ${[...trail, id].join(" -> ")}`);
    return;
  }
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dep of tasks.get(id)?.deps ?? []) visit(dep, [...trail, id]);
  visiting.delete(id);
  visited.add(id);
};
for (const id of tasks.keys()) visit(id);

const ownership = read("docs/integration/ownership-map.yaml").split(/\r?\n/);
const writable = [];
let agent = null;
let mode = null;
for (const line of ownership) {
  const agentMatch = line.match(/^ {2}([A-Za-z0-9_-]+):$/);
  if (agentMatch && agentMatch[1] !== "locked_paths") {
    agent = agentMatch[1];
    mode = null;
    continue;
  }
  if (line.match(/^ {4}writable_paths:$/)) {
    mode = "writable";
    continue;
  }
  if (line.match(/^ {4}read_only_paths:$/)) {
    mode = "read_only";
    continue;
  }
  if (mode === "writable") {
    const pathMatch = line.match(/^ {6}- (.+)$/);
    if (pathMatch) writable.push({ agent, pattern: pathMatch[1] });
  }
}
const directoryBase = (pattern) =>
  pattern.endsWith("/**") ? pattern.slice(0, -3) : pattern;
for (let i = 0; i < writable.length; i += 1) {
  for (let j = i + 1; j < writable.length; j += 1) {
    const left = directoryBase(writable[i].pattern);
    const right = directoryBase(writable[j].pattern);
    if (
      left === right ||
      left.startsWith(`${right}/`) ||
      right.startsWith(`${left}/`)
    ) {
      errors.push(
        `ownership writable overlap: ${writable[i].agent}:${writable[i].pattern} <-> ${writable[j].agent}:${writable[j].pattern}`,
      );
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`[wave1-planning] ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `[wave1-planning] documents: passed; tasks: ${tasks.size}; dependency cycles: none; ownership writable overlaps: none`,
  );
}
