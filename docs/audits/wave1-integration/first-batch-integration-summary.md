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

The repair branch has actual results for `npm ci`, `npm run format`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run contract`, `npm run build`, `npm run smoke`, `npm run e2e:smoke`, `npm run security`, `node scripts/check.mjs all` and the remaining final CI commands to be recorded in the repair summary. Node runtime was `v24.16.0`; npm audit reported zero vulnerabilities in the successful security scan. An attempted local Chromium download timed out; the platform E2E was then run with the installed Microsoft Edge channel.

## Scope guard

No SQLite business tables, PDF parsing, content-addressed storage, MockModelGateway runtime, real BYOK HTTP call, project/workflow API, Web business page, Playwright business flow, Markdown export or Excel export was added. Real external model calls are a later manual acceptance item only.
