import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "../../../apps/api/src/server.js";
import { PDF_UPLOAD_MAX_BYTES } from "../../../apps/api/src/upload-limits.js";
import { openDatabase } from "../../../packages/storage/src/index.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("bounded PDF upload API", () => {
  it("accepts a PDF larger than 1 MiB and enqueues DOCUMENT_IMPORT", async () => {
    const setup = createSetup();
    const app = createApiServer(setup);
    try {
      const project = await createProject(app, "Large PDF");
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${project}/documents`,
        headers: pdfHeaders("two-megabyte.pdf", "large-pdf"),
        payload: pdfBytes(2 * 1024 * 1024),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        schema_version: "api.v1",
        data: {
          document_id: expect.stringMatching(/^doc_/),
          document_version_id: expect.stringMatching(/^docv_/),
          job_id: expect.stringMatching(/^job_/),
        },
      });
      const { job_id: jobId } = (response.json() as { data: { job_id: string } }).data;
      const database = openDatabase(setup.databasePath, {
        migrationsDirectory: setup.migrationsDirectory,
      });
      try {
        expect(database
          .prepare("SELECT kind, state FROM jobs WHERE job_id = ?")
          .get(jobId)).toEqual({ kind: "DOCUMENT_IMPORT", state: "QUEUED" });
      } finally {
        database.close();
      }
    } finally {
      await app.close();
    }
  });

  it("accepts a dynamically generated PDF close to the manual 8.34 MiB size", async () => {
    const setup = createSetup();
    const app = createApiServer(setup);
    try {
      const project = await createProject(app, "Acceptance-sized PDF");
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${project}/documents`,
        headers: pdfHeaders("acceptance-sized.pdf", "acceptance-sized"),
        payload: pdfBytes(9 * 1024 * 1024),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        document_id: expect.stringMatching(/^doc_/),
        document_version_id: expect.stringMatching(/^docv_/),
        job_id: expect.stringMatching(/^job_/),
      });
    } finally {
      await app.close();
    }
  });

  it("returns a CORS-safe api.v1 413 without creating persisted objects above 32 MiB", async () => {
    const setup = createSetup();
    const app = createApiServer(setup);
    try {
      const project = await createProject(app, "Too large PDF");
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/projects/${project}/documents`,
        headers: {
          ...pdfHeaders("too-large.pdf", "too-large"),
          origin: "http://127.0.0.1:4173",
        },
        payload: pdfBytes(PDF_UPLOAD_MAX_BYTES + 1),
      });

      expect(response.statusCode).toBe(413);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:4173",
      );
      expect(response.json()).toMatchObject({
        schema_version: "api.v1",
        request_id: expect.stringMatching(/^req_/),
        error: {
          code: "PDF_TOO_LARGE",
          message: "PDF 文件不能超过 32 MiB。",
          request_id: expect.stringMatching(/^req_/),
          details: [],
        },
      });
      const database = openDatabase(setup.databasePath, {
        migrationsDirectory: setup.migrationsDirectory,
      });
      try {
        expect(database.prepare("SELECT COUNT(*) as count FROM documents").get()).toEqual({ count: 0 });
        expect(database.prepare("SELECT COUNT(*) as count FROM document_versions").get()).toEqual({ count: 0 });
        expect(database.prepare("SELECT COUNT(*) as count FROM jobs").get()).toEqual({ count: 0 });
      } finally {
        database.close();
      }
    } finally {
      await app.close();
    }
  });

  it("keeps the default body limit for ordinary JSON routes", async () => {
    const setup = createSetup();
    const app = createApiServer(setup);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ name: "x".repeat(2 * 1024 * 1024) }),
      });

      expect(response.statusCode).toBe(413);
      expect(response.json()).not.toMatchObject({
        error: { code: "PDF_TOO_LARGE" },
      });
    } finally {
      await app.close();
    }
  });
});

function createSetup() {
  const directory = mkdtempSync(join(tmpdir(), "pdf-upload-limits-"));
  temporaryDirectories.push(directory);
  return {
    databasePath: join(directory, "workflow.sqlite"),
    contentRoot: join(directory, "content"),
    migrationsDirectory: join(
      process.cwd(),
      "apps",
      "api",
      "migrations",
    ),
  };
}

async function createProject(app: ReturnType<typeof createApiServer>, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/projects",
    payload: { name },
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { data: { project_id: string } }).data.project_id;
}

function pdfHeaders(filename: string, idempotencyKey: string) {
  return {
    "content-type": "application/pdf",
    "x-filename": filename,
    "idempotency-key": idempotencyKey,
  };
}

function pdfBytes(size: number): Buffer {
  const bytes = Buffer.alloc(size, 0x20);
  Buffer.from("%PDF-1.7\n").copy(bytes);
  Buffer.from("\n%%EOF\n").copy(bytes, size - 7);
  return bytes;
}
