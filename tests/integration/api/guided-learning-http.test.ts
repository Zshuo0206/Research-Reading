import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InjectOptions } from "light-my-request";
import { describe, expect, it } from "vitest";
import { createApiRuntime } from "../../../apps/api/src/runtime.js";
import { createApiServer } from "../../../apps/api/src/server.js";

describe("Guided Learning BYOK and PDF HTTP boundaries", () => {
  it("serves a registered PDF inline after refresh and rejects invalid page requests", async () => {
    const directory = await mkdtemp(join(tmpdir(), "research-reading-http-"));
    const contentRoot = join(directory, "content");
    const databasePath = join(directory, "runtime.sqlite");
    const pdf = Buffer.from("%PDF-1.7 fake test content");
    const sha = createHash("sha256").update(pdf).digest("hex");
    const setup = createApiRuntime(databasePath, contentRoot);
    setup.storage.createProject("proj_http", "HTTP");
    setup.storage.createDocument("doc_http", "proj_http", "paper.pdf");
    setup.storage.createDocumentVersion({
      documentVersionId: "docv_http",
      documentId: "doc_http",
      sourceSha256: sha,
      pageCount: 1,
      extractionProfileVersion: "pdf-text-v1",
    });
    setup.database.close();
    await writeFile(
      join(contentRoot, sha.slice(0, 2), `${sha}.pdf`),
      pdf,
    ).catch(async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(contentRoot, sha.slice(0, 2)), { recursive: true });
      await writeFile(join(contentRoot, sha.slice(0, 2), `${sha}.pdf`), pdf);
    });
    const app = createApiServer({ databasePath, contentRoot });
    const ok = await app.inject({
      method: "GET",
      url: "/api/v1/document-versions/docv_http/content",
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toContain("application/pdf");
    expect(ok.headers["content-disposition"]).toBe("inline");
    expect(ok.rawPayload).toEqual(pdf);
    const pageQuery = await app.inject({
      method: "GET",
      url: "/api/v1/document-versions/docv_http/content?page=1",
    });
    expect(pageQuery.statusCode).toBe(400);
    expect(pageQuery.json()).toMatchObject({
      schema_version: "api.v1",
      error: { code: "PDF_PAGE_QUERY_UNSUPPORTED" },
    });
    const invalidId = await app.inject({
      method: "GET",
      url: "/api/v1/document-versions/invalid/content",
    });
    expect(invalidId.statusCode).toBe(400);
    expect(invalidId.json()).toMatchObject({
      schema_version: "api.v1",
      error: { code: "INVALID_RESOURCE_ID" },
    });
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/document-versions/docv_unknown/content",
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({
      schema_version: "api.v1",
      error: { code: "DOCUMENT_CONTENT_NOT_FOUND" },
    });
    await rm(join(contentRoot, sha.slice(0, 2), `${sha}.pdf`));
    const unavailable = await app.inject({
      method: "GET",
      url: "/api/v1/document-versions/docv_http/content",
    });
    expect(unavailable.statusCode).toBe(500);
    expect(unavailable.json()).toMatchObject({
      schema_version: "api.v1",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(unavailable.body).not.toContain(contentRoot);
    const missingRoute = await app.inject({
      method: "GET",
      url: "/api/v1/not-a-real-route",
    });
    expect(missingRoute.statusCode).toBe(404);
    expect(missingRoute.json()).toMatchObject({
      schema_version: "api.v1",
      error: { code: "ROUTE_NOT_FOUND" },
    });
    const malformedJson = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: { "content-type": "application/json" },
      payload: "{not-json",
    });
    expect(malformedJson.statusCode).toBe(400);
    expect(malformedJson.json()).toMatchObject({
      schema_version: "api.v1",
      error: { code: "BAD_REQUEST" },
    });
    expect(malformedJson.body).not.toContain("SyntaxError");
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("accepts sanitized BYOK provider config without a client secret reference", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "research-reading-http-byok-"),
    );
    const databasePath = join(directory, "runtime.sqlite");
    const app = createApiServer({
      databasePath,
      contentRoot: join(directory, "content"),
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/guided-learning/sessions",
      payload: {
        project_id: "proj_missing",
        document_version_id: "docv_missing",
        learning_goal: "goal",
        provider_config: {
          provider: "CUSTOM_OPENAI_COMPATIBLE",
          base_url: "https://fake-provider.test/v1",
          model: "fake",
          request_timeout_ms: 30000,
          max_input_characters: 1000,
          max_output_tokens: 100,
          runtime_secret_ref: {
            kind: "SESSION_MEMORY",
            handle: "secret_session_client",
          },
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.job_id).toMatch(/^job_/);
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("classifies malformed Guided Learning HTTP input without leaking internal errors", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "research-reading-guided-errors-"),
    );
    const databasePath = join(directory, "runtime.sqlite");
    const contentRoot = join(directory, "content");
    const setup = createApiRuntime(databasePath, contentRoot);
    const created = setup.guidedLearningHandlers.create({
      project_id: "proj_errors",
      document_version_id: "docv_errors",
      learning_goal: "Validate request errors",
    });
    setup.guidedLearningRuntime.generateDirections(created.session.session_id);
    const evidenceSession = setup.guidedLearningHandlers.create({
      project_id: "proj_evidence",
      document_version_id: "docv_evidence",
      learning_goal: "Validate Evidence conflict",
    });
    setup.guidedLearningRuntime.generateDirections(
      evidenceSession.session.session_id,
    );
    setup.guidedLearningRuntime.executeCommand({
      session_id: evidenceSession.session.session_id,
      contract_version: "guided-learning.v1",
      event: "SELECT_DIRECTION",
      payload: { direction_id: "direction_method" },
      idempotency_key: "errors-select",
    });
    setup.guidedLearningRuntime.executeCommand({
      session_id: evidenceSession.session.session_id,
      contract_version: "guided-learning.v1",
      event: "START_STAGE",
      payload: { stage_id: "UNDERSTAND" },
      idempotency_key: "errors-start",
    });
    setup.guidedLearningRuntime.writeQuestions(
      evidenceSession.session.session_id,
    );
    const beforeAnswer = setup.guidedLearningRuntime.getSession(
      evidenceSession.session.session_id,
    );
    const evidenceQuestion = beforeAnswer.questions?.[0];
    setup.guidedLearningRuntime.executeCommand({
      session_id: evidenceSession.session.session_id,
      contract_version: "guided-learning.v1",
      event: "SUBMIT_ANSWER",
      payload: {
        question_id: evidenceQuestion?.question_id,
        question_order: evidenceQuestion?.order,
        answer: "test answer",
      },
      idempotency_key: "errors-answer",
    });
    setup.guidedLearningRuntime.writeFeedback({
      session_id: evidenceSession.session.session_id,
      feedback: { summary: "test", omissions: [] },
      reference_answer: {
        text: "insufficient",
        claims: [
          {
            text: "unsupported",
            claim_type: "INSUFFICIENT_EVIDENCE",
            evidence_refs: [],
          },
        ],
      },
      evidence: [],
    });
    setup.database.close();

    const app = createApiServer({ databasePath, contentRoot });
    const provider = {
      provider: "CUSTOM_OPENAI_COMPATIBLE",
      base_url: "https://provider.invalid/v1",
      model: "test-model",
      request_timeout_ms: 30000,
      max_input_characters: 1000,
      max_output_tokens: 100,
    };
    const commandUrl = `/api/v1/guided-learning/sessions/${created.session.session_id}/commands`;
    const cases: Array<{
      name: string;
      request: InjectOptions;
      status: number;
      code: string;
    }> = [
      {
        name: "missing project_id",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions",
          payload: { document_version_id: "docv", learning_goal: "goal" },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "missing document_version_id",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions",
          payload: { project_id: "proj", learning_goal: "goal" },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "empty learning_goal",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions",
          payload: {
            project_id: "proj",
            document_version_id: "docv",
            learning_goal: "",
          },
        },
        status: 400,
        code: "VALIDATION_FAILED",
      },
      {
        name: "provider_config string",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions",
          payload: {
            project_id: "proj",
            document_version_id: "docv",
            learning_goal: "goal",
            provider_config: "invalid",
          },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "illegal provider",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions",
          payload: {
            project_id: "proj",
            document_version_id: "docv",
            learning_goal: "goal",
            provider_config: { ...provider, provider: "INVALID" },
          },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "HTTP provider URL",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions",
          payload: {
            project_id: "proj",
            document_version_id: "docv",
            learning_goal: "goal",
            provider_config: {
              ...provider,
              base_url: "http://provider.invalid/v1",
            },
          },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "provider URL query",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions",
          payload: {
            project_id: "proj",
            document_version_id: "docv",
            learning_goal: "goal",
            provider_config: {
              ...provider,
              base_url: "https://provider.invalid/v1?secret=value",
            },
          },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "command missing event",
        request: {
          method: "POST",
          url: commandUrl,
          payload: {
            contract_version: "guided-learning.v1",
            payload: {},
            idempotency_key: "missing-event",
          },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "command missing idempotency key",
        request: {
          method: "POST",
          url: commandUrl,
          payload: {
            contract_version: "guided-learning.v1",
            event: "SELECT_DIRECTION",
            payload: { direction_id: "direction_method" },
          },
        },
        status: 400,
        code: "VALIDATION_ERROR",
      },
      {
        name: "command payload is not an object",
        request: {
          method: "POST",
          url: commandUrl,
          payload: {
            contract_version: "guided-learning.v1",
            event: "SELECT_DIRECTION",
            payload: "invalid",
            idempotency_key: "invalid-payload",
          },
        },
        status: 400,
        code: "INVALID_COMMAND",
      },
      {
        name: "illegal client event",
        request: {
          method: "POST",
          url: commandUrl,
          payload: {
            contract_version: "guided-learning.v1",
            event: "DIRECTIONS_READY",
            payload: {},
            idempotency_key: "illegal-event",
          },
        },
        status: 400,
        code: "INVALID_COMMAND",
      },
      {
        name: "missing session",
        request: {
          method: "POST",
          url: "/api/v1/guided-learning/sessions/learning_missing/commands",
          payload: {
            contract_version: "guided-learning.v1",
            event: "SELECT_DIRECTION",
            payload: { direction_id: "direction_method" },
            idempotency_key: "missing-session",
          },
        },
        status: 404,
        code: "NOT_FOUND",
      },
      {
        name: "Evidence is not ready for confirmation",
        request: {
          method: "POST",
          url: `/api/v1/guided-learning/sessions/${evidenceSession.session.session_id}/commands`,
          payload: {
            contract_version: "guided-learning.v1",
            event: "CONFIRM_QUESTION",
            payload: {
              question_id: evidenceQuestion?.question_id,
              question_order: evidenceQuestion?.order,
            },
            idempotency_key: "evidence-not-ready",
          },
        },
        status: 409,
        code: "EVIDENCE_NOT_READY",
      },
    ];

    for (const testCase of cases) {
      const response = await app.inject(testCase.request);
      expect(response.statusCode, testCase.name).toBe(testCase.status);
      expect(response.statusCode, testCase.name).not.toBe(500);
      const body = response.json();
      expect(body, testCase.name).toMatchObject({
        schema_version: "api.v1",
        error: { code: testCase.code, details: [] },
      });
      for (const forbidden of [
        "Error",
        "stack",
        "SQL",
        "project_id, document_version_id and learning_goal are required",
        "Model base_url",
        "D:\\\\",
      ])
        expect(response.body, `${testCase.name}: ${forbidden}`).not.toContain(
          forbidden,
        );
    }
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
});
