import { mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApiRuntime } from "../../../apps/api/src/runtime.js";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";
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
    const worker = createWorkerRuntime("byok-worker", databasePath, { byokHttpClient: fakeHttp, byokEnvironment: { WORKFLOW_BYOK_API_KEY: testKey }, byokLogger: { log: (event) => loggerEvents.push(event) } });
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
    const feedbackQuestion = session.questions?.[0] as unknown as { evidence: Array<{ quote: string }>; reference_answer: { claims: Array<{ evidence_refs: string[] }> } };
    expect(feedbackQuestion.evidence[0]?.quote).toBe(text);
    expect(feedbackQuestion.reference_answer.claims[0]?.evidence_refs).toHaveLength(1);
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
    const text = "重复证据。重复证据。";
    const hash = createHash("sha256").update(text).digest("hex");
    api.storage.createDocumentVersion({ documentVersionId: "docv_invalid", documentId: "doc_invalid", sourceSha256: hash, pageCount: 1, extractionProfileVersion: "pdf-text-v1" });
    api.storage.saveDocumentPages("docv_invalid", [{ pageNumber: 1, canonicalPageText: text, pageTextSha256: hash, extractionProfileVersion: "pdf-text-v1", codePointLength: Array.from(text).length }]);
    const gateway = { invoke: async (request: unknown) => {
      const value = request as { operation: string; input?: { context_spans?: Array<{ context_span_id: string }> } };
      if (value.operation === "GENERATE_GUIDED_DIRECTIONS") return response(value.operation, { directions: [{ title: "一", description: "一", selection_basis: "一" }, { title: "二", description: "二", selection_basis: "二" }] });
      if (value.operation === "GENERATE_GUIDED_QUESTIONS") return response(value.operation, { questions: [{ text: "一？" }, { text: "二？" }, { text: "三？" }] });
      return response(value.operation, { status: "SUCCESS", summary: "无效证据", omissions: [], reference_answer: "无法确认", claims: [{ text: "无法确认", claim_type: "PAPER_FACT", context_span_id: value.input?.context_spans?.[0]?.context_span_id ?? "context_missing", evidence_quote_candidate: "不存在的引用" }] });
    } };
    const worker = createWorkerRuntime("invalid-worker", databasePath, { guidedLearningGateway: gateway });
    const created = api.guidedLearningHandlers.create({ project_id: "proj_invalid", document_version_id: "docv_invalid", learning_goal: "验证 Evidence", provider_config: provider });
    await worker.jobRuntime.runOnce();
    let session = api.guidedLearningRuntime.getSession(created.session.session_id);
    await command(api, session.session_id, "SELECT_DIRECTION", { direction_id: session.candidate_directions[0].direction_id });
    await command(api, session.session_id, "START_STAGE", { stage_id: "UNDERSTAND" });
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    const question = session.questions?.[0];
    await command(api, session.session_id, "SUBMIT_ANSWER", { question_id: question?.question_id, question_order: question?.order, answer: "回答" });
    await worker.jobRuntime.runOnce();
    session = api.guidedLearningRuntime.getSession(session.session_id);
    const insufficientQuestion = session.questions?.[0] as unknown as { evidence: unknown[]; reference_answer: { claims: Array<{ claim_type: string }> } };
    expect(insufficientQuestion.evidence).toEqual([]);
    expect(insufficientQuestion.reference_answer.claims[0]?.claim_type).toBe("INSUFFICIENT_EVIDENCE");
    worker.database.close();
    api.database.close();
    await rm(directory, { recursive: true, force: true });
  });
});

async function command(api: ReturnType<typeof createApiRuntime>, sessionId: string, event: "SELECT_DIRECTION" | "START_STAGE" | "SUBMIT_ANSWER" | "CONFIRM_QUESTION" | "ADVANCE_QUESTION" | "SKIP_QUESTION", payload: unknown) {
  return api.guidedLearningRuntime.executeCommand({ session_id: sessionId, contract_version: "guided-learning.v1", event, payload, idempotency_key: `byok:${event}:${Math.random()}` });
}

function response(operation: string, output: unknown) {
  return { schema_version: "model-gateway.v1", message_kind: "RESPONSE", operation, output };
}
