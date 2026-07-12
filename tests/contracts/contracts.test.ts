import { describe, expect, it } from "vitest";
import {
  CONTRACT_VERSIONS,
  JOB_TRANSITIONS,
  PROVIDER_PRESETS,
  canTransitionJob,
  codePointLength,
  isValidEvidenceInterval,
  validateContextSpan,
  validateEvidenceSpan,
} from "../../packages/contracts/wave1/src/index.js";
import type {
  CanonicalPageContext,
  ContextSpan,
  EvidenceSpan,
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
    expect(isValidEvidenceInterval("A😀B", 2, 2, "")).toBe(false);
    expect(isValidEvidenceInterval("A😀B", 3, 2, "")).toBe(false);
  });

  it("validates ContextSpan and EvidenceSpan against canonical page identity", () => {
    const page = {
      document_version_id: "docv_1",
      page_number: 1,
      canonical_page_text: "A😀B",
      page_text_sha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      extraction_profile_version: "pdfjs-text-v1",
    } satisfies CanonicalPageContext;
    const context = {
      context_span_id: "context_1",
      document_version_id: "docv_1",
      page_number: 1,
      char_start: 1,
      char_end: 3,
      text: "😀B",
      page_text_sha256: page.page_text_sha256,
      extraction_profile_version: page.extraction_profile_version,
    } satisfies ContextSpan;
    const evidence = {
      evidence_span_id: "evidence_1",
      context_span_id: "context_1",
      document_version_id: "docv_1",
      page_number: 1,
      char_start: 1,
      char_end: 2,
      quote: "😀",
      page_text_sha256: page.page_text_sha256,
      extraction_profile_version: page.extraction_profile_version,
      verification_status: "VERIFIED",
    } satisfies EvidenceSpan;

    expect(validateContextSpan(context, page)).toBe(true);
    expect(validateEvidenceSpan(evidence, page)).toBe(true);
    expect(validateContextSpan({ ...context, char_start: 3 }, page)).toBe(
      false,
    );
    expect(
      validateContextSpan({ ...context, char_start: 2, char_end: 2 }, page),
    ).toBe(false);
    expect(validateEvidenceSpan({ ...evidence, char_end: 4 }, page)).toBe(
      false,
    );
    expect(validateEvidenceSpan({ ...evidence, quote: "B" }, page)).toBe(false);
    expect(
      validateEvidenceSpan(
        { ...evidence, page_text_sha256: "b".repeat(64) },
        page,
      ),
    ).toBe(false);
    expect(
      validateEvidenceSpan(
        { ...evidence, document_version_id: "docv_2" },
        page,
      ),
    ).toBe(false);
    expect(
      validateEvidenceSpan(
        { ...evidence, extraction_profile_version: "pdfjs-text-v2" },
        page,
      ),
    ).toBe(false);
  });
});
