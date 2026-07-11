# External Review Handoff Protocol

## 1. Responsibility boundaries

- The execution Agent implements the assigned scope, runs local tests and prepares factual evidence.
- The execution Agent does not issue the final review conclusion, Gate conclusion or next-batch authorization.
- The independent reviewer examines scope, contracts, architecture, security, tests, licensing and process evidence.
- The human project owner decides material scope changes, major risks and final authorization.

## 2. Three handoff levels

### Level 1 — task handoff

For one task, record task ID, owner, branch, commit SHA, changed paths, command names and exit codes, known limitations and out-of-scope work. Do not create a ZIP by default.

### Level 2 — batch integration handoff (default)

For a completed batch, provide a factual summary and the Git commit range from the approved base to HEAD. The commit range is the source of truth for tracked changes. Do not create a ZIP, duplicate full logs or duplicate a complete file inventory by default. Reference CI or retained command evidence where available.

### Level 3 — independent external review package

Use Level 3 only when the review covers a public contract, evidence/audit boundary, database migration, security/network boundary, cross-owner integration, release/human decision, inaccessible CI artifacts or an explicit external-review request. Provide the summary and commit range or patch; add a ZIP only when the reviewer cannot access the repository/CI, binary or untracked contents are material, or the reviewer explicitly requests it.

## 3. Summary minimum content

The summary identifies branch and HEAD, base commit or range, working-tree state, completed and incomplete tasks, actual change scope, command exit codes, test counts, Schema or migration counts, security and licensing results, scope-boundary observations, process deviations and known limitations. It must not contain a final review conclusion, Gate C authorization or an automatic next-batch decision.

## 4. ZIP rules when Level 3 applies

The ZIP must contain the complete relevant tracked diff, actual contents of relevant untracked files, key source/configuration files, tests, retained command logs or their exact evidence references, state/task/RFC/devlog files, file list and SHA-256 records. It must exclude node_modules, build output, caches, local databases, actual `.env` files, secrets, unlicensed PDFs, old unrelated review bundles and Git object data.

## 5. Evidence reuse

- Reuse complete existing logs; do not repeat successful commands without a material reason.
- If HEAD, dependencies, source or tests changed, rerun only affected checks and identify older evidence as stale.
- If the workspace changes after evidence generation, mark the summary stale or regenerate the affected evidence.
- Preserve command failures verbatim when they materially affect review; do not retain only a later successful rerun.
- Untracked files are not part of a normal commit-range handoff; include them only when Level 3 requires their contents.

## 6. Security and licensing

- Never copy an API Key into summaries, ZIPs, logs, fixtures or diffs.
- If a suspected real secret is found, record only path, line range and secret type, then stop material generation.
- Do not include an actual `.env`, unlicensed PDF or local database.
- Ordinary CI and review-material generation must not call a real external model.

## 7. Review conclusion rules

Execution materials must not state a final approval/rejection conclusion, Gate C approval or automatic next-batch authorization. Only an independent reviewer and the authorized project decision-maker may update those records.

## 8. Expected independent review output

The reviewer separately reports overall and per-task conclusions, blocking issues, non-blocking remediation, scope-boundary findings, security/licensing findings, submission readiness, candidate next-batch tasks and tasks that must remain locked.
