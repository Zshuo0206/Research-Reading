import { describe, expect, it } from "vitest";
import {
  CONTRACT_VERSIONS,
  JOB_TRANSITIONS,
  PROVIDER_PRESETS,
  canTransitionJob,
  codePointLength,
  isValidEvidenceInterval,
} from "../../packages/contracts/wave1/src/index.js";

describe("wave1.v1 TypeScript contract surface", () => {
  it("keeps the public contract versions complete", () => {
    expect(CONTRACT_VERSIONS).toEqual([
      "api.v1",
      "document.v1",
      "job.v1",
      "question-plan.v1",
      "answer.v1",
      "evidence.v1",
      "model-gateway.v1",
    ]);
  });

  it("defines BYOK provider presets without a secret field", () => {
    expect(Object.keys(PROVIDER_PRESETS)).toEqual([
      "OPENAI",
      "GEMINI",
      "GROQ",
      "OPENROUTER",
    ]);
    expect(JSON.stringify(PROVIDER_PRESETS)).not.toMatch(/key|secret/i);
  });

  it("enforces job migration rules", () => {
    expect(canTransitionJob("QUEUED", "RUNNING")).toBe(true);
    expect(canTransitionJob("SUCCEEDED", "QUEUED")).toBe(false);
    expect(JOB_TRANSITIONS.RUNNING).toContain("CANCEL_REQUESTED");
  });

  it("uses Unicode code points and exact right-open evidence intervals", () => {
    expect(codePointLength("A😀B")).toBe(3);
    expect(isValidEvidenceInterval("A😀B", 1, 2, "😀")).toBe(true);
    expect(isValidEvidenceInterval("A😀B", 1, 3, "😀B")).toBe(true);
    expect(isValidEvidenceInterval("A😀B", 0, 4, "A😀B")).toBe(false);
  });
});
