# Wave 1 First-Batch Repair Summary

This is a factual handoff for independent review. It is not a final review conclusion, Gate conclusion or next-batch authorization.

## 1. Generation and Git identity

- Generated at: `2026-07-12T01:20:29.8327818+08:00`
- Branch: `repair/wave1-first-batch`
- HEAD: `1846d95bb579afc9d8da00e72bad8ee61dba6165`
- Approved base: `996e69720f85cea6738d2997b6534882e904d1a9`
- Commit: `1846d95 repair wave1 first batch foundation blockers`
- Commit range for review: `996e69720f85cea6738d2997b6534882e904d1a9..1846d95bb579afc9d8da00e72bad8ee61dba6165`
- The implementation range endpoint is `1846d95`; this summary and the ZIP are handoff artifacts and do not expand the implementation scope.
- Working tree after the repair commit: no tracked or untracked non-ignored changes.
- Old review bundle and old external-review ZIP remain on disk but are ignored and were not committed or copied into the repair package.

## 2. Current task and Gate records

- T-W1-001: `REVIEW`
- T-W1-002: `REVIEW`
- T-W1-007: `PARTIAL`
- Contract version: `wave1.v1`
- Gate A record: `REPAIR_REVIEW_PENDING`
- Gate B record: `GRANTED` for the human-approved first-batch scope only.
- Gate C record: `LOCKED`.
- T-W1-003A, T-W1-003B, T-W1-004, T-W1-004B, T-W1-005, T-W1-006A, T-W1-006 and T-W1-008 remain planning/locked work. No next batch was started.

## 3. Actual repair scope

### Contracts

- API success and failure envelopes are mutually exclusive and use one unified error object.
- ContextSpan and EvidenceSpan are distinct; Evidence references use `evidence_span_id` and carry document version, page, canonical page hash, extraction profile and right-open coordinates.
- ModelGateway is discriminated by `GENERATE_QUESTION_PLAN`, `GENERATE_ANSWER` and `CONNECTION_TEST`; model output does not accept final character offsets or final evidence coordinates.
- BYOK provider configuration separates normal persisted configuration from runtime secret input, supports OpenAI/Gemini/Groq/OpenRouter and custom OpenAI-compatible HTTPS base URLs.
- Nine JSON Schemas have deterministic generated TypeScript declarations. The contract command compiles all nine schemas, exercises positive/negative fixtures and validates four metadata-only evaluation samples.

### Platform and CI

- Root npm workspaces, Node 24 engine enforcement, strict TypeScript, Biome, Vitest, Ajv contract checks, workspace builds, security/license/audit checks and CI workflow are present.
- API, Worker and Web are platform shells only. API/Web loopback is fixed to `127.0.0.1`; no business API, PDF parser, database, model runtime or business Web workflow was added.
- Platform smoke verifies API health, Worker smoke and Web shell. Playwright platform smoke verifies API health and the Web shell. The Windows configuration uses the installed Microsoft Edge channel; CI installs Chromium on Ubuntu.

### Evaluation and governance

- Evaluation material remains metadata-only: manifest schema, source/license/hash fields, human reference formats, rejection format, Mock fixture metadata and QA checklist.
- No paper PDF, user research data, real model output, real API key or external model call was added.
- External-review handoff was reduced to Level 1 task handoff, Level 2 default batch summary/commit range and Level 3 package only when external access, material untracked content or an explicit request requires it.

## 4. Change inventory

The base-to-HEAD range contains `99` changed paths, `7,501` insertions and `156` deletions. The complete name-status list and binary-capable diff are included in the repair ZIP. Main groups are:

- `packages/contracts/wave1/**`: seven business schemas, registry, unified error schema, ModelGateway schema, generated declarations and contract source.
- `tests/contracts/**`, `tests/fixtures/contracts/**`, `tests/fixtures/evaluation/**`.
- `apps/api/**`, `apps/worker/**`, `apps/web/**`, `infra/**`, `compose.yaml`, TypeScript/Biome/Playwright configuration.
- `scripts/**`, `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `.npmrc`, `.nvmrc`, `.env.example`.
- `docs/CURRENT_STATE.md`, Wave 1 plan/startup summary, RFC, task files, ownership map, handoffs, evaluation/process docs and devlog.

No delete or rename was recorded in the repair commit. The original pre-repair planning changes were already present in the dirty workspace; the one-time repair branch preserves and commits that Wave 1 baseline together with the repair changes.

## 5. Actual verification results

| Command | Exit code | Recorded result |
|---|---:|---|
| `node --version` | 0 | `v24.16.0` |
| `npm --version` | 0 | `11.13.0` |
| `npm ci` | 0 | 175 packages added; 180 audited; 0 vulnerabilities |
| `npm run format` | 0 | Biome checked 21 files; no fixes |
| `npm run lint` | 0 | Biome checked 21 files; no diagnostics requiring failure |
| `npm run typecheck` | 0 | Root and all workspaces strict typecheck completed |
| `npm run test` | 0 | 1 contract test file; 4 tests; skipped/todo/disabled: 0/0/0 |
| `npm run contract` | 0 | 9 schemas; positive/negative/boundary checks; 4 metadata-only samples |
| `npm run build` | 0 | Contracts, API, Worker and Web builds completed |
| `npm run smoke` | 0 | Loopback API, Worker smoke and Web shell verified |
| `npm run e2e:smoke` | 0 | 1 Playwright platform test passed using installed Edge channel on Windows |
| `npm run security` | 0 | No suspected secret, tracked `.env`, SQLite or PDF; npm audit 0 vulnerabilities; dependency/license check completed |
| `node scripts/check.mjs all` | 0 | Planning, dependency-cycle, ownership and structural checks completed |
| `npm run ci` | 0 | Unified format/lint/typecheck/test/contract/build/smoke/E2E/security/diff command completed |
| `git diff --check` | 0 | Only Git LF-to-CRLF warnings; no whitespace error |

## 6. Failed or superseded attempts retained as facts

- The first contract run failed because Ajv schemas with external references were compiled before all schemas were registered; the test harness was corrected and the contract command was rerun successfully.
- The first format command used unsupported Biome 2 `--check` syntax; the package command was corrected to Biome read-only format mode.
- The first typecheck failed on the contracts workspace include path and generated declaration import resolution; both platform/typing issues were corrected and typecheck reran successfully.
- The first Vitest run accidentally collected the Playwright spec and failed; the test command was narrowed to `tests/contracts`, with Playwright retained as a separate smoke command.
- The first platform smoke failed on Windows child-process startup and then on the Web working directory; the smoke runner was changed to direct Node/Vite processes with explicit loopback/Web working directory and rerun successfully.
- The first security scan reported workspace packages without license metadata and two dependency license identifiers outside the allowlist; workspace MIT metadata and reviewed `CC-BY-4.0`/`Python-2.0` identifiers were recorded, then security reran successfully.
- Local Chromium download timed out after 240 seconds. The process tree was terminated after confirmation, and the Windows Playwright configuration used the already installed Edge channel; the E2E command then completed with exit code 0. CI retains an explicit Chromium install step.

## 7. Security, licensing and scope observations

- No real API key was found in tracked source, SQLite, fixtures, logs or audit materials; no actual `.env` file is tracked. The scan printed no secret value.
- No CI command calls a real external model. No model SDK or provider HTTP implementation was started in this repair.
- No PDF or unconfirmed-license paper binary is in the committed repair range. The evaluation manifest is metadata-only and has no binary SHA-256 to claim; its required source/license/hash fields are schema-validated placeholders for future locally supplied material.
- No SQLite business tables, PDF parsing, content-addressed storage, Evidence materialization runtime, MockModelGateway runtime, real BYOK HTTP, project/workflow API, business Web page or formal export was implemented.

## 8. Process deviations and review limits

- The repair was performed by the main control Agent on one repair branch after preserving the pre-existing dirty workspace.
- No independent task branches or worktrees were created for this repair. This is explicitly recorded as a one-time process deviation.
- The repair branch is not merged into `main`; `main` remains at the approved base commit.
- T-W1-007 is `PARTIAL` because no redistribution-cleared paper PDF was supplied and no real PDF/model execution or independent QA sign-off is claimed.
- The execution material does not provide an independent review conclusion or Gate C decision.
