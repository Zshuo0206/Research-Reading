# T-W1-001 Handoff

- Task: `T-W1-001`
- Status: `REVIEW`
- Agent: Orchestrator acting as contract owner for this single-agent execution
- Contract: `wave1.v1`

## Implemented

- Added `api.v1`, `document.v1`, `job.v1`, `question-plan.v1`, `answer.v1`, `evidence.v1`, `model-gateway.v1`, `error.v1` and registry schemas.
- Added generated TypeScript contract surface, provider presets, Job transition helper, ContextSpan/EvidenceSpan boundary helper and BYOK secret separation.
- Added positive/negative/compatibility/boundary contract checks, including missing version, illegal state, invalid Evidence interval, unsupported factual claim without evidence, direct model offsets and plaintext API key rejection.

## Tests executed

```text
npm run contract  PASS
npm run typecheck  PASS
npm run test       PASS (4 tests)
npm run build      PASS
```

No real model call, PDF parser, SQLite, or business API was implemented; the real provider remains an external manual-acceptance path only.
