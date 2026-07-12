# T-W1-001 Handoff

- Task: `T-W1-001`
- Status: `REVIEW`
- Agent: Orchestrator acting as contract owner for this single-agent execution
- Contract: `wave1.v1`

## Implemented

- Added `api.v1`, `document.v1`, `job.v1`, `question-plan.v1`, `answer.v1`, `evidence.v1`, `model-gateway.v1`, `error.v1` and registry schemas.
- Added generated TypeScript request/response union, provider presets, Job transition helper, `validateContextSpan`/`validateEvidenceSpan` and one invocation-only BYOK secret reference.
- Model output is draft-only: QuestionPlanDraft has language/retrieval/questions text; AnswerDraft has text/claim type/candidate refs and no persistent IDs.
- Added request/response exclusivity, claim/evidence conditions, connection-test conditions, TypeScript narrowing, external `$ref` context and schema-drift tests.

## Tests executed

```text
npm run contract  exit 0 (9 schemas; drift probe; positive/negative fixtures)
npm run typecheck exit 0 (generated discriminator narrowing compiled)
npm run test      exit 0 (11 tests across 2 files)
npm run build     exit 0
```

No real model call, PDF parser, SQLite, or business API was implemented; the real provider remains an external manual-acceptance path only.
