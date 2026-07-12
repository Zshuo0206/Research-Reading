# Wave 1 First-Batch Integration Audit

- Date: 2026-07-11 Asia/Shanghai
- Scope: T-W1-001, T-W1-002, T-W1-007 only
- Contract: `wave1.v1`
- Gate A: `REPAIR_REVIEW_PENDING`
- Gate B: `GRANTED` for this first batch only
- Gate C: `LOCKED`; later tasks remain locked/draft

## Result

T-W1-001 and T-W1-002 are `REVIEW` after repair. T-W1-007 remains `PARTIAL` because the repository intentionally contains metadata-only evaluation fixtures and no redistribution-cleared paper PDF. No final reviewer conclusion or signature is asserted; the repair evidence is based on actual command results and the current diff.

## Evidence

The final repair has exit-code-0 results for `npm ci`, format, lint, typecheck, 11 Vitest tests, 9-Schema contract checks, build, platform smoke, one Playwright smoke, security with four forbidden-file probes, unified `npm run ci`, `node scripts/check.mjs all` and `git diff --check`. Node was `v24.16.0`; npm audit reported zero vulnerabilities. `docker compose config` exited 1 because Docker CLI is unavailable on this host, so compose up/health/down was not executed. Review handoff uses the implementation commit range; no summary or ZIP is part of that implementation range.

## Scope guard

No SQLite business tables, PDF parsing, content-addressed storage, MockModelGateway runtime, real BYOK HTTP call, project/workflow API, Web business page, Playwright business flow, Markdown export or Excel export was added. Real external model calls are a later manual acceptance item only.
