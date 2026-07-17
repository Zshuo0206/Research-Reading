import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    setup.storage.createDocumentVersion({ documentVersionId: "docv_http", documentId: "doc_http", sourceSha256: sha, pageCount: 1, extractionProfileVersion: "pdf-text-v1" });
    setup.database.close();
    await writeFile(join(contentRoot, sha.slice(0, 2), `${sha}.pdf`), pdf).catch(async () => {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(contentRoot, sha.slice(0, 2)), { recursive: true });
      await writeFile(join(contentRoot, sha.slice(0, 2), `${sha}.pdf`), pdf);
    });
    const app = createApiServer({ databasePath, contentRoot });
    const ok = await app.inject({ method: "GET", url: "/api/v1/document-versions/docv_http/content" });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["content-type"]).toContain("application/pdf");
    expect(ok.headers["content-disposition"]).toBe("inline");
    expect(ok.rawPayload).toEqual(pdf);
    expect((await app.inject({ method: "GET", url: "/api/v1/document-versions/docv_http/content?page=2" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/v1/document-versions/docv_unknown/content" })).statusCode).toBe(404);
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("accepts sanitized BYOK provider config without a client secret reference", async () => {
    const directory = await mkdtemp(join(tmpdir(), "research-reading-http-byok-"));
    const databasePath = join(directory, "runtime.sqlite");
    const app = createApiServer({ databasePath, contentRoot: join(directory, "content") });
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
          runtime_secret_ref: { kind: "SESSION_MEMORY", handle: "secret_session_client" },
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.job_id).toMatch(/^job_/);
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
});
