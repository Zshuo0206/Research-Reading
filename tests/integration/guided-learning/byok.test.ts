import { mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiRuntime } from "../../../apps/api/src/runtime.js";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";
import {
  resolveClaim,
  shadowMatchBucket,
  type GuidedLearningEvidenceResolutionEvent,
  type GuidedLearningEvidenceResolutionLogger,
} from "../../../apps/worker/src/workflow/guided-learning.js";
import { OpenAICompatibleByokGateway } from "../../../packages/model-gateway/src/openai-compatible.js";
import { RuntimeSecretResolver, SessionMemorySecretStore } from "../../../packages/runtime-secrets/src/index.js";

const provider = {
  provider: "CUSTOM_OPENAI_COMPATIBLE" as const,
  base_url: "https://fake-provider.test/v1",
  model: "fake-guided-v1",
  request_timeout_ms: 30000,
  max_input_characters: 200000,
  max_output_tokens: 2000,
};

describe("Guided Learning real BYOK-shaped generation", () => {
  it("calls a fake OpenAI-compatible HTTP provider for all four guided operations", async () => {
    const operations = [
      "GENERATE_GUIDED_DIRECTIONS",
      "GENERATE_GUIDED_QUESTIONS",
      "GENERATE_GUIDED_FEEDBACK",
      "GENERATE_GUIDED_STAGE_SUMMARY",
    ] as const;
    const seen: string[] = [];
    const testKey = ["fake", "test", "secret"].join("-");
    const gateway = new OpenAICompatibleByokGateway(
      new RuntimeSecretResolver(new SessionMemorySecretStore(), { WORKFLOW_BYOK_API_KEY: testKey }),
      async (_input, init) => {
        expect(String(init?.headers && new Headers(init.headers).get("authorization"))).toBe(`Bearer ${testKey}`);
        const body = JSON.parse(String(init?.body)) as { messages?: Array<{ content?: string }> };
        const request = JSON.parse(String(body.messages?.[1]?.content)) as { operation?: string; output_requirements?: { shape?: unknown; constraints?: unknown } };
        seen.push(String(request.operation));
        expect(request.output_requirements?.shape).toBeDefined();
        expect(request.output_requirements?.constraints).toBeDefined();
        const output = request.operation === "GENERATE_GUIDED_DIRECTIONS"
          ? { directions: [{ title: "A", description: "A", selection_basis: "A" }, { title: "B", description: "B", selection_basis: "B" }] }
          : request.operation === "GENERATE_GUIDED_QUESTIONS"
            ? { questions: [{ text: "Q1" }, { text: "Q2" }, { text: "Q3" }] }
            : request.operation === "GENERATE_GUIDED_FEEDBACK"
              ? { status: "SUCCESS", summary: "S", omissions: [], reference_answer: "R", claims: [{ text: "paper quote", claim_type: "PAPER_FACT", context_span_id: "context_fake_1", evidence_quote_candidate: "paper quote" }] }
              : { key_mastery_points: ["K"], major_weak_points: [], next_stage_hint: "N" };
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), { status: 200, headers: { "content-type": "application/json" } });
      },
    );
    const context = { context_span_id: "context_fake_1", document_version_id: "docv_fake", page_number: 1, char_start: 0, char_end: 11, text: "paper quote", page_text_sha256: "a".repeat(64), extraction_profile_version: "pdf-text-v1" };
    for (const operation of operations) {
      const request = { schema_version: "model-gateway.v1", message_kind: "REQUEST", operation, provider_config: provider, runtime_secret_ref: { kind: "ENVIRONMENT", name: "WORKFLOW_BYOK_API_KEY" }, input: { learning_goal: "goal", document_metadata: { document_version_id: "docv_fake", page_count: 1 }, context_spans: [context] } };
      const result = await gateway.invoke(request as never);
      expect(result.operation).toBe(operation);
    }
    expect(seen).toEqual(operations);
  });

  it("persists one provider config and drives all four outputs from a fake provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "research-reading-byok-"));
    const databasePath = join(directory, "runtime.sqlite");
    const api = createApiRuntime(databasePath, join(directory, "content"));
    api.storage.createProject("proj_byok", "BYOK");
    api.storage.createDocument("doc_byok", "proj_byok", "paper.pdf");
    const text = "这是第一个页面。方法通过实验验证研究结论。";
    const hash = createHash("sha256").update(text).digest("hex");
    api.storage.createDocumentVersion({
      documentVersionId: "docv_byok",
      documentId: "doc_byok",
      sourceSha256: hash,
      pageCount: 1,
      extractionProfileVersion: "pdf-text-v1",
    });
    api.storage.saveDocumentPages("docv_byok", [{
      pageNumber: 1,
      canonicalPageText: text,
      pageTextSha256: hash,
      extractionProfileVersion: "pdf-text-v1",
      codePointLength: Array.from(text).length,
    }]);
    const requests: Array<{ operation: string; input: Record<string, unknown> }> = [];
    const testKey = ["fake", "test", "secret"].join("-");
    const loggerEvents: unknown[] = [];
    const evidenceEvents: GuidedLearningEvidenceResolutionEvent[] = [];
    const fakeHttp = async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${testKey}`);
      const body = JSON.parse(String(init?.body)) as { messages?: Array<{ content?: string }> };
      const value = JSON.parse(String(body.messages?.[1]?.content)) as { operation: string; input: Record<string, unknown> };
      requests.push(value);
      const contextSpans = Array.isArray(value.input.context_spans) ? value.input.context_spans as Array<{ context_span_id: string; text: string }> : [];
      const span = contextSpans[0];
      const output = value.operation === "GENERATE_GUIDED_DIRECTIONS"
        ? { directions: [{ title: "模型方向一", description: "由 fake provider 生成。", selection_basis: "学习目标匹配。" }, { title: "模型方向二", description: "第二个模型方向。", selection_basis: "证据可回查。" }] }
        : value.operation === "GENERATE_GUIDED_QUESTIONS"
          ? { questions: [{ text: "模型问题一？" }, { text: "模型问题二？" }, { text: "模型问题三？" }] }
          : value.operation === "GENERATE_GUIDED_FEEDBACK"
          ? { status: "SUCCESS", summary: "模型点评", omissions: [], reference_answer: text, claims: [
            { text: "该段落描述了方法流程。", claim_type: "PAPER_FACT", context_span_id: span?.context_span_id ?? "context_missing", evidence_quote_candidate: span?.text ?? text },
            { text: "这段原文也是该方法依据。", claim_type: "AUTHOR_CLAIM", context_span_id: span?.context_span_id ?? "context_missing", evidence_quote_candidate: span?.text ?? text },
          ] }
            : { key_mastery_points: ["模型总结的掌握点"], major_weak_points: ["模型指出的薄弱点"], next_stage_hint: "模型建议继续复习。" };
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const worker = createWorkerRuntime("byok-worker", databasePath, { byokHttpClient: fakeHttp, byokEnvironment: { WORKFLOW_BYOK_API_KEY: testKey }, byokLogger: { log: (event) => loggerEvents.push(event) }, guidedLearningEvidenceResolutionLogger: { log: (event) => evidenceEvents.push(event) } });
    const created = api.guidedLearningHandlers.create({
      project_id: "proj_byok",
      document_version_id: "docv_byok",
      learning_goal: "理解方法",
      provider_config: provider,
    });
    await worker.jobRuntime.runOnce();
    let session = api.guidedLearningRuntime.getSession(created.session.session_id);
    expect(session.candidate_directions[0]?.title).toBe("模型方向一");
    expect(api.storage.getJob(created.job_id)?.payload).toMatchObject({ provider_config: provider });
    expect(JSON.stringify(created)).not.toContain(testKey);
    expect(JSON.stringify(api.database.prepare("SELECT payload_json, snapshot_json FROM jobs CROSS JOIN guided_learning_sessions").all())).not.toContain(testKey);
    await command(api, session.session_id, "SELECT_DIRECTION", { direction_id: session.candidate_directions[0].direction_id });
    session = api.guidedLearningRuntime.getSession(session.session_id);
    await command(api, session.session_id, "START_STAGE", { stage_id: "UNDERSTAND" });
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    expect(session.questions?.map((question) => question.prompt)).toEqual(["模型问题一？", "模型问题二？", "模型问题三？"]);
    const question = session.questions?.[0];
    await command(api, session.session_id, "SUBMIT_ANSWER", { question_id: question?.question_id, question_order: question?.order, answer: "我的模型驱动回答" });
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    const feedbackQuestion = session.questions?.[0] as unknown as {
      evidence: Array<{ quote: string }>;
      reference_answer: { text: string; claims: Array<{ evidence_refs: string[] }> };
    };
    expect(feedbackQuestion.evidence[0]?.quote).toBe(text);
    expect(feedbackQuestion.reference_answer.claims[0]?.evidence_refs).toHaveLength(1);
    expect(feedbackQuestion.reference_answer.text).toContain(
      "有原文支持的参考内容：",
    );
    expect(feedbackQuestion.reference_answer.text).not.toBe(text);
    const firstPointer = { question_id: session.questions?.[0]?.question_id, question_order: 1 };
    await command(api, session.session_id, "CONFIRM_QUESTION", firstPointer);
    await command(api, session.session_id, "ADVANCE_QUESTION", firstPointer);
    session = api.guidedLearningRuntime.getSession(session.session_id);
    for (const order of [2, 3]) {
      const pointer = { question_id: session.questions?.[order - 1]?.question_id, question_order: order };
      await command(api, session.session_id, "SKIP_QUESTION", { ...pointer, reason: "I_DONT_KNOW" });
      await command(api, session.session_id, "ADVANCE_QUESTION", pointer);
      session = api.guidedLearningRuntime.getSession(session.session_id);
    }
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    expect(session.stage_summary?.key_mastery_points).toEqual(["模型总结的掌握点"]);
    expect(session.stage_summary?.major_weak_points).toEqual(["模型指出的薄弱点"]);
    expect(requests.map((request) => request.operation)).toEqual(["GENERATE_GUIDED_DIRECTIONS", "GENERATE_GUIDED_QUESTIONS", "GENERATE_GUIDED_FEEDBACK", "GENERATE_GUIDED_STAGE_SUMMARY"]);
    for (const operation of ["GENERATE_GUIDED_QUESTIONS", "GENERATE_GUIDED_FEEDBACK", "GENERATE_GUIDED_STAGE_SUMMARY"]) {
      expect(requests.find((request) => request.operation === operation)?.input.selected_direction).toMatchObject({ title: "模型方向一", description: "由 fake provider 生成。", selection_basis: "学习目标匹配。" });
    }
    const feedbackInput = requests.find((request) => request.operation === "GENERATE_GUIDED_FEEDBACK")?.input;
    expect(feedbackInput).toMatchObject({ current_question: "模型问题一？", current_question_order: 1, user_answer: "我的模型驱动回答" });
    expect(feedbackQuestion.evidence).toHaveLength(1);
    expect(feedbackQuestion.reference_answer.claims).toHaveLength(2);
    expect(feedbackQuestion.reference_answer.claims[0]?.evidence_refs).toEqual(feedbackQuestion.reference_answer.claims[1]?.evidence_refs);
    expect(evidenceEvents).toHaveLength(2);
    expect(evidenceEvents.map((event) => [event.claim_index, event.resolution_reason, event.exact_match_count_bucket])).toEqual([
      [0, "VERIFIED", "ONE"],
      [1, "VERIFIED", "ONE"],
    ]);
    expect(evidenceEvents.every((event) => event.operation === "GUIDED_LEARNING_FEEDBACK_GENERATION")).toBe(true);
    const summaryInput = requests.find((request) => request.operation === "GENERATE_GUIDED_STAGE_SUMMARY")?.input;
    expect(summaryInput?.question_history).toHaveLength(3);
    expect(summaryInput?.completed_question_orders).toEqual([1]);
    expect(summaryInput?.skipped_question_orders).toEqual([2, 3]);
    expect(JSON.stringify(loggerEvents)).not.toContain(testKey);
    expect(JSON.stringify(api.database.prepare("SELECT provider_config_json, snapshot_json FROM guided_learning_provider_configs CROSS JOIN guided_learning_sessions").all())).not.toContain(testKey);
    expect((api.database.prepare("SELECT payload_json FROM jobs").all() as Array<{ payload_json: string }>).every((row) => JSON.parse(row.payload_json).provider_config && JSON.stringify(JSON.parse(row.payload_json).provider_config) === JSON.stringify(provider))).toBe(true);
    worker.database.close();
    api.database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("turns an unknown or ambiguous quote into insufficient evidence without a fake span", async () => {
    const directory = await mkdtemp(join(tmpdir(), "research-reading-byok-invalid-"));
    const databasePath = join(directory, "runtime.sqlite");
    const api = createApiRuntime(databasePath, join(directory, "content"));
    api.storage.createProject("proj_invalid", "Invalid");
    api.storage.createDocument("doc_invalid", "proj_invalid", "paper.pdf");
    const text = "SECRET_PAGE_TEXT_MARKER 重复证据。重复证据。";
    const hash = createHash("sha256").update(text).digest("hex");
    api.storage.createDocumentVersion({ documentVersionId: "SECRET_DOCUMENT_ID_MARKER", documentId: "doc_invalid", sourceSha256: hash, pageCount: 1, extractionProfileVersion: "pdf-text-v1" });
    api.storage.saveDocumentPages("SECRET_DOCUMENT_ID_MARKER", [{ pageNumber: 1, canonicalPageText: text, pageTextSha256: hash, extractionProfileVersion: "pdf-text-v1", codePointLength: Array.from(text).length }]);
    const gateway = { invoke: async (request: unknown) => {
      const value = request as { operation: string; input?: { context_spans?: Array<{ context_span_id: string }> } };
      if (value.operation === "GENERATE_GUIDED_DIRECTIONS") return response(value.operation, { directions: [{ title: "一", description: "一", selection_basis: "一" }, { title: "二", description: "二", selection_basis: "二" }] });
      if (value.operation === "GENERATE_GUIDED_QUESTIONS") return response(value.operation, { questions: [{ text: "一？" }, { text: "二？" }, { text: "三？" }] });
      return response(value.operation, { status: "SUCCESS", summary: "SECRET_FEEDBACK_SUMMARY_MARKER", omissions: [], reference_answer: "SECRET_REFERENCE_ANSWER_MARKER", claims: [
        { text: "SECRET_CLAIM_TEXT_MARKER", claim_type: "PAPER_FACT", context_span_id: value.input?.context_spans?.[0]?.context_span_id ?? "context_missing", evidence_quote_candidate: "SECRET_QUOTE_MARKER" },
        { text: "SECRET_CLAIM_TEXT_MARKER", claim_type: "INSUFFICIENT_EVIDENCE" },
      ] });
    } };
    const evidenceEvents: GuidedLearningEvidenceResolutionEvent[] = [];
    const worker = createWorkerRuntime("invalid-worker", databasePath, { guidedLearningGateway: gateway, guidedLearningEvidenceResolutionLogger: { log: (event) => evidenceEvents.push(event) } });
    const created = api.guidedLearningHandlers.create({ project_id: "proj_invalid", document_version_id: "SECRET_DOCUMENT_ID_MARKER", learning_goal: "验证 Evidence", provider_config: provider });
    await worker.jobRuntime.runOnce();
    let session = api.guidedLearningRuntime.getSession(created.session.session_id);
    await command(api, session.session_id, "SELECT_DIRECTION", { direction_id: session.candidate_directions[0].direction_id });
    await command(api, session.session_id, "START_STAGE", { stage_id: "UNDERSTAND" });
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    const question = session.questions?.[0];
    await command(api, session.session_id, "SUBMIT_ANSWER", { question_id: question?.question_id, question_order: question?.order, answer: "SECRET_USER_ANSWER_MARKER" });
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    const insufficientQuestion = session.questions?.[0] as unknown as {
      evidence: unknown[];
      reference_answer: {
        text: string;
        claims: Array<{ claim_type: string; evidence_refs: string[] }>;
      };
    };
    expect(insufficientQuestion.evidence).toEqual([]);
    expect(insufficientQuestion.reference_answer.claims[0]?.claim_type).toBe("INSUFFICIENT_EVIDENCE");
    expect(insufficientQuestion.reference_answer.claims[1]?.claim_type).toBe("INSUFFICIENT_EVIDENCE");
    expect(insufficientQuestion.reference_answer.claims.every((claim) => claim.evidence_refs.length === 0)).toBe(true);
    expect(insufficientQuestion.reference_answer.text).toBe("当前证据不足，暂不提供可确认的论文参考答案。");
    expect(insufficientQuestion.reference_answer.text).not.toContain("SECRET_REFERENCE_ANSWER_MARKER");
    expect(evidenceEvents.map((event) => [event.claim_index, event.resolution_reason, event.exact_match_count_bucket])).toEqual([
      [0, "QUOTE_NOT_FOUND", "ZERO"],
      [1, "MODEL_INSUFFICIENT_EVIDENCE", "NOT_CHECKED"],
    ]);
    expect(evidenceEvents[0]).toMatchObject({
      shadow_probe_version: "quote-shadow.v1",
      shadow_nfc_match_bucket: "ZERO",
      shadow_nfkc_match_bucket: "ZERO",
      shadow_whitespace_match_bucket: "ZERO",
      shadow_dehyphenation_match_bucket: "ZERO",
      shadow_punctuation_match_bucket: "ZERO",
      shadow_casefold_match_bucket: "ZERO",
      shadow_layout_combined_match_bucket: "ZERO",
      shadow_broad_combined_match_bucket: "ZERO",
    });
    expect(evidenceEvents[1]?.shadow_probe_version).toBeUndefined();
    const allowedEventFields = new Set([
      "event", "operation", "claim_index", "model_claim_type", "resolution_outcome", "resolution_reason",
      "context_span_id_present", "context_span_found", "document_version_matches", "quote_present", "quote_codepoint_length",
      "exact_match_count_bucket", "page_number", "shadow_probe_version", "shadow_nfc_match_bucket", "shadow_nfkc_match_bucket",
      "shadow_whitespace_match_bucket", "shadow_dehyphenation_match_bucket", "shadow_punctuation_match_bucket", "shadow_casefold_match_bucket",
      "shadow_layout_combined_match_bucket", "shadow_broad_combined_match_bucket",
    ]);
    for (const event of evidenceEvents)
      for (const field of Object.keys(event)) expect(allowedEventFields.has(field)).toBe(true);
    const serializedEvents = JSON.stringify(evidenceEvents);
    for (const marker of [
      "SECRET_USER_ANSWER_MARKER",
      "SECRET_CLAIM_TEXT_MARKER",
      "SECRET_QUOTE_MARKER",
      "SECRET_PAGE_TEXT_MARKER",
      "SECRET_CONTEXT_ID_MARKER",
      "SECRET_DOCUMENT_ID_MARKER",
      "SECRET_API_KEY_MARKER",
      "SECRET_FEEDBACK_SUMMARY_MARKER",
      "SECRET_REFERENCE_ANSWER_MARKER",
    ]) expect(serializedEvents).not.toContain(marker);
    worker.database.close();
    api.database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("stores a mixed reference answer from resolved claims without raw model prose", async () => {
    const result = await runSingleFeedbackScenario(
      { log: () => undefined },
      {
        includeInsufficient: true,
        referenceAnswer: "RAW_UNSUPPORTED_REFERENCE_TEXT",
      },
    );
    const question = result.questions?.[0] as unknown as {
      evidence: unknown[];
      reference_answer: {
        text: string;
        claims: Array<{
          text: string;
          claim_type: string;
          evidence_refs: string[];
        }>;
      };
    };
    expect(question.evidence).toHaveLength(1);
    expect(question.reference_answer.claims[0]?.evidence_refs).toHaveLength(1);
    expect(question.reference_answer.claims[1]).toMatchObject({
      claim_type: "INSUFFICIENT_EVIDENCE",
      evidence_refs: [],
    });
    expect(question.reference_answer.text).toContain("有原文支持的参考内容：");
    expect(question.reference_answer.text).toContain("当前证据不足：");
    expect(question.reference_answer.text).not.toContain("RAW_UNSUPPORTED_REFERENCE_TEXT");
  });

  it("classifies every Evidence resolution branch without exposing claim or source text", () => {
    const context = {
      context_span_id: "SECRET_CONTEXT_ID_MARKER",
      document_version_id: "SECRET_DOCUMENT_ID_MARKER",
      page_number: 7,
      text: "abc abc unique quote",
      page_text_sha256: "a".repeat(64),
      extraction_profile_version: "pdf-text-v1",
    };
    const claim = (overrides: Record<string, unknown>) => ({
      text: "SECRET_CLAIM_TEXT_MARKER",
      claim_type: "PAPER_FACT",
      context_span_id: context.context_span_id,
      evidence_quote_candidate: "unique quote",
      ...overrides,
    });
    const missingQuoteClaim = { ...claim({}) } as Record<string, unknown>;
    delete missingQuoteClaim.evidence_quote_candidate;
    const results = [
      resolveClaim({ text: "SECRET_CLAIM_TEXT_MARKER", claim_type: "INSUFFICIENT_EVIDENCE" }, [context], context.document_version_id),
      resolveClaim(claim({ context_span_id: "" }), [context], context.document_version_id),
      resolveClaim(claim({ context_span_id: "missing_context" }), [context], context.document_version_id),
      resolveClaim(claim({ evidence_quote_candidate: "unique quote" }), [{ ...context, document_version_id: "other_document" }], context.document_version_id),
      resolveClaim(missingQuoteClaim, [context], context.document_version_id),
      resolveClaim(claim({ evidence_quote_candidate: "" }), [context], context.document_version_id),
      resolveClaim(claim({ evidence_quote_candidate: "a" }), [context], context.document_version_id),
      resolveClaim(claim({ evidence_quote_candidate: "x".repeat(1001) }), [context], context.document_version_id),
      resolveClaim(claim({ evidence_quote_candidate: "xyz" }), [context], context.document_version_id),
      resolveClaim(claim({ evidence_quote_candidate: "abc" }), [context], context.document_version_id),
      resolveClaim(claim({ evidence_quote_candidate: "unique quote" }), [context], context.document_version_id),
    ];
    expect(results.map((result) => result.diagnostic.resolution_reason)).toEqual([
      "MODEL_INSUFFICIENT_EVIDENCE",
      "CONTEXT_SPAN_ID_MISSING",
      "CONTEXT_SPAN_NOT_FOUND",
      "DOCUMENT_VERSION_MISMATCH",
      "QUOTE_MISSING",
      "QUOTE_MISSING",
      "QUOTE_TOO_SHORT",
      "QUOTE_TOO_LONG",
      "QUOTE_NOT_FOUND",
      "QUOTE_NOT_UNIQUE",
      "VERIFIED",
    ]);
    expect(results.map((result) => result.diagnostic.exact_match_count_bucket)).toEqual([
      "NOT_CHECKED",
      "NOT_CHECKED",
      "NOT_CHECKED",
      "NOT_CHECKED",
      "NOT_CHECKED",
      "NOT_CHECKED",
      "NOT_CHECKED",
      "NOT_CHECKED",
      "ZERO",
      "MULTIPLE",
      "ONE",
    ]);
    expect(results[0]?.diagnostic.context_span_id_present).toBeUndefined();
    expect(results[10]?.diagnostic.resolution_outcome).toBe("VERIFIED");
    expect(results[10]?.evidence).toMatchObject({
      context_span_id: context.context_span_id,
      document_version_id: context.document_version_id,
      page_number: 7,
      char_start: 8,
      char_end: 20,
      quote: "unique quote",
      verification_status: "VERIFIED",
    });
    expect(results[10]?.diagnostic.shadow_probe_version).toBeUndefined();
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 9, 10])
      expect(results[index]?.diagnostic.shadow_probe_version).toBeUndefined();
    expect(JSON.stringify(results.map((result) => result.diagnostic))).not.toContain("SECRET_");
  });

  it("classifies shadow-only quote mismatches without changing the business result", () => {
    const baseContext = {
      context_span_id: "shadow_context",
      document_version_id: "shadow_document",
      page_number: 4,
      page_text_sha256: "a".repeat(64),
      extraction_profile_version: "pdf-text-v1",
    };
    const resolveShadow = (pageText: string, quote: string) => resolveClaim(
      { text: "shadow claim", claim_type: "PAPER_FACT", context_span_id: baseContext.context_span_id, evidence_quote_candidate: quote },
      [{ ...baseContext, text: pageText }],
      baseContext.document_version_id,
    ).diagnostic;
    const zeroShadows = {
      shadow_nfc_match_bucket: "ZERO",
      shadow_nfkc_match_bucket: "ZERO",
      shadow_whitespace_match_bucket: "ZERO",
      shadow_dehyphenation_match_bucket: "ZERO",
      shadow_punctuation_match_bucket: "ZERO",
      shadow_casefold_match_bucket: "ZERO",
      shadow_layout_combined_match_bucket: "ZERO",
      shadow_broad_combined_match_bucket: "ZERO",
    } as const;
    const cases = [
      { name: "NFC", pageText: "café", quote: "cafe\u0301", expected: { ...zeroShadows, shadow_nfc_match_bucket: "ONE", shadow_nfkc_match_bucket: "ONE", shadow_layout_combined_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "NFKC", pageText: "①②③", quote: "123", expected: { ...zeroShadows, shadow_nfkc_match_bucket: "ONE", shadow_layout_combined_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "whitespace", pageText: "alpha beta", quote: "alpha  beta", expected: { ...zeroShadows, shadow_whitespace_match_bucket: "ONE", shadow_layout_combined_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "NBSP", pageText: "alpha beta", quote: "alpha\u00a0beta", expected: { ...zeroShadows, shadow_nfkc_match_bucket: "ONE", shadow_whitespace_match_bucket: "ONE", shadow_punctuation_match_bucket: "ONE", shadow_layout_combined_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "dehyphenation", pageText: "controller", quote: "control-\nler", expected: { ...zeroShadows, shadow_dehyphenation_match_bucket: "ONE", shadow_layout_combined_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "ordinary-hyphen", pageText: "model-based", quote: "modelbased", expected: zeroShadows },
      { name: "punctuation", pageText: "\u201cquote\u201d", quote: '"quote"', expected: { ...zeroShadows, shadow_punctuation_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "casefold", pageText: "Case Sensitive", quote: "case sensitive", expected: { ...zeroShadows, shadow_casefold_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "layout", pageText: "①  controller", quote: "1 control-\nler", expected: { ...zeroShadows, shadow_layout_combined_match_bucket: "ONE", shadow_broad_combined_match_bucket: "ONE" } },
      { name: "broad", pageText: "\u201c①  controller\u201d", quote: '"1 control-\nLER"', expected: { ...zeroShadows, shadow_broad_combined_match_bucket: "ONE" } },
      { name: "paraphrase", pageText: "The method uses a controller.", quote: "This approach employs a control unit.", expected: zeroShadows },
      { name: "multiple", pageText: "foo  bar foo  bar", quote: "foo bar", expected: { ...zeroShadows, shadow_whitespace_match_bucket: "MULTIPLE", shadow_layout_combined_match_bucket: "MULTIPLE", shadow_broad_combined_match_bucket: "MULTIPLE" } },
    ] as const;
    for (const { name, pageText, quote, expected } of cases) {
      const diagnostic = resolveShadow(pageText, quote);
      expect(diagnostic.resolution_reason, name).toBe("QUOTE_NOT_FOUND");
      expect(diagnostic.resolution_outcome, name).toBe("INSUFFICIENT_EVIDENCE");
      expect(diagnostic.exact_match_count_bucket, name).toBe("ZERO");
      expect(diagnostic.shadow_probe_version, name).toBe("quote-shadow.v1");
      for (const [field, bucket] of Object.entries(expected))
        expect((diagnostic as unknown as Record<string, unknown>)[field], name).toBe(bucket);
      expect(JSON.stringify(diagnostic)).not.toContain("shadow claim");
    }
    expect(shadowMatchBucket("page", "quote", () => { throw new Error("probe failure"); })).toBe("NOT_RUN");
  });

  it("does not create Evidence when a shadow probe finds a normalized match", async () => {
    const evidenceEvents: GuidedLearningEvidenceResolutionEvent[] = [];
    const session = await runSingleFeedbackScenario(
      { log: (event) => evidenceEvents.push(event) },
      { pageText: "Canonical Text", quote: "canonical text" },
    );
    const question = session.questions?.[0] as unknown as { evidence?: unknown[]; reference_answer?: { claims?: Array<{ claim_type: string }> } } | undefined;
    expect(session.state).toBe("FEEDBACK_READY");
    expect(question?.evidence).toEqual([]);
    expect(question?.reference_answer?.claims?.[0]?.claim_type).toBe("INSUFFICIENT_EVIDENCE");
    expect(evidenceEvents[0]).toMatchObject({
      resolution_reason: "QUOTE_NOT_FOUND",
      resolution_outcome: "INSUFFICIENT_EVIDENCE",
      exact_match_count_bucket: "ZERO",
      shadow_casefold_match_bucket: "ONE",
    });
  });

  it("isolates logger failures and preserves the normal feedback result", async () => {
    const normal = await runSingleFeedbackScenario({ log: () => undefined });
    const capturedEvents: GuidedLearningEvidenceResolutionEvent[] = [];
    const withCapturingLogger = await runSingleFeedbackScenario({ log: (event) => capturedEvents.push(event) });
    const withThrowingLogger = await runSingleFeedbackScenario({ log: () => { throw new Error("diagnostic logger failure"); } });
    const comparable = (session: Awaited<ReturnType<typeof runSingleFeedbackScenario>>) => ({
      state: session.state,
      session_revision: session.session_revision,
      state_version: session.state_version,
      current_question_order: session.current_question_order,
      questions: (session.questions as unknown as Array<Record<string, unknown>> | undefined)?.map((question) => ({
        order: question.order,
        status: question.status,
        feedback: question.feedback,
        reference_answer: question.reference_answer,
        evidence: question.evidence,
      })),
    });
    expect(comparable(withCapturingLogger)).toEqual(comparable(normal));
    expect(comparable(withThrowingLogger)).toEqual(comparable(normal));
    expect(capturedEvents).toHaveLength(1);
    expect(withThrowingLogger.state).toBe("FEEDBACK_READY");
    const question = withThrowingLogger.questions?.[0] as unknown as { evidence?: unknown[]; reference_answer?: { claims?: unknown[] } } | undefined;
    expect(question?.evidence).toHaveLength(1);
    expect(question?.reference_answer?.claims).toHaveLength(1);
  });
});

async function command(api: ReturnType<typeof createApiRuntime>, sessionId: string, event: "SELECT_DIRECTION" | "START_STAGE" | "SUBMIT_ANSWER" | "CONFIRM_QUESTION" | "ADVANCE_QUESTION" | "SKIP_QUESTION", payload: unknown) {
  return api.guidedLearningRuntime.executeCommand({ session_id: sessionId, contract_version: "guided-learning.v1", event, payload, idempotency_key: `byok:${event}:${Math.random()}` });
}

function response(operation: string, output: unknown) {
  return { schema_version: "model-gateway.v1", message_kind: "RESPONSE", operation, output };
}

async function runSingleFeedbackScenario(
  logger: GuidedLearningEvidenceResolutionLogger,
  options: {
    pageText?: string;
    quote?: string;
    includeInsufficient?: boolean;
    referenceAnswer?: string;
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "research-reading-diagnostics-"));
  const databasePath = join(directory, "runtime.sqlite");
  const api = createApiRuntime(databasePath, join(directory, "content"));
  api.storage.createProject("proj_diagnostics", "Diagnostics");
  api.storage.createDocument("doc_diagnostics", "proj_diagnostics", "paper.pdf");
  const text = options.pageText ?? "唯一证据引用";
  const quote = options.quote ?? text;
  const hash = createHash("sha256").update(text).digest("hex");
  api.storage.createDocumentVersion({ documentVersionId: "docv_diagnostics", documentId: "doc_diagnostics", sourceSha256: hash, pageCount: 1, extractionProfileVersion: "pdf-text-v1" });
  api.storage.saveDocumentPages("docv_diagnostics", [{ pageNumber: 1, canonicalPageText: text, pageTextSha256: hash, extractionProfileVersion: "pdf-text-v1", codePointLength: Array.from(text).length }]);
  const gateway = { invoke: async (request: unknown) => {
    const value = request as { operation: string; input?: { context_spans?: Array<{ context_span_id: string; text: string }> } };
    if (value.operation === "GENERATE_GUIDED_DIRECTIONS") return response(value.operation, { directions: [{ title: "一", description: "一", selection_basis: "一" }, { title: "二", description: "二", selection_basis: "二" }] });
    if (value.operation === "GENERATE_GUIDED_QUESTIONS") return response(value.operation, { questions: [{ text: "一？" }, { text: "二？" }, { text: "三？" }] });
    const span = value.input?.context_spans?.[0];
    return response(value.operation, {
      status: "SUCCESS",
      summary: "点评",
      omissions: [],
      reference_answer: options.referenceAnswer ?? "参考",
      claims: [
        { text: "主张", claim_type: "PAPER_FACT", context_span_id: span?.context_span_id, evidence_quote_candidate: quote },
        ...(options.includeInsufficient
          ? [{
              text: "未支持主张",
              claim_type: "INSUFFICIENT_EVIDENCE",
            }]
          : []),
      ],
    });
  } };
  const worker = createWorkerRuntime("diagnostics-worker", databasePath, { guidedLearningGateway: gateway, guidedLearningEvidenceResolutionLogger: logger });
  const created = api.guidedLearningHandlers.create({ project_id: "proj_diagnostics", document_version_id: "docv_diagnostics", learning_goal: "验证诊断", provider_config: provider });
  await worker.jobRuntime.runOnce();
  let session = api.guidedLearningRuntime.getSession(created.session.session_id);
  await command(api, session.session_id, "SELECT_DIRECTION", { direction_id: session.candidate_directions[0].direction_id });
  await command(api, session.session_id, "START_STAGE", { stage_id: "UNDERSTAND" });
  await worker.jobRuntime.runOnce();
  session = api.guidedLearningRuntime.getSession(session.session_id);
  const question = session.questions?.[0];
  await command(api, session.session_id, "SUBMIT_ANSWER", { question_id: question?.question_id, question_order: question?.order, answer: "回答" });
  await worker.jobRuntime.runOnce();
  const result = api.guidedLearningRuntime.getSession(session.session_id);
  worker.database.close();
  api.database.close();
  await rm(directory, { recursive: true, force: true });
  return result;
}
