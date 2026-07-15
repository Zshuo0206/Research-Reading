import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";
import { createDocumentImportJobHandler } from "../../../apps/worker/src/workflow/document-import.js";
import {
  openDatabase,
  StorageRepository,
} from "../../../packages/storage/src/index.js";
import { extractTextPdf, sha256 } from "../../../packages/pdf/src/index.js";

const fixture = fileURLToPath(
  new URL("../../fixtures/pdf/synthetic-text.pdf", import.meta.url),
);
const temporaryDirectories: string[] = [];
const migrationsDirectory = fileURLToPath(
  new URL("../../../apps/api/migrations/", import.meta.url),
);

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("Wave 1 workflow HTTP API", () => {
  it("runs real PDF import and question plan through default runtimes", async () => {
    const setup = createSetup();
    const app = createApiServer({
      databasePath: setup.databasePath,
      contentRoot: setup.contentRoot,
    });
    const project = data(
      await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: { name: "Default PDF runtime" },
      }),
    );
    const upload = data(
      await app.inject({
        method: "POST",
        url: `/api/v1/projects/${project.project_id}/documents`,
        headers: {
          "content-type": "application/pdf",
          "x-filename": "synthetic-text.pdf",
          "idempotency-key": "default-import",
        },
        payload: await readFile(fixture),
      }),
    );

    const worker = createWorkerRuntime(
      "worker_default_pdf",
      setup.databasePath,
    );
    expect(await worker.jobRuntime.runOnce()).toBe(true);
    worker.database.close();

    expect(
      data(
        await app.inject({
          method: "GET",
          url: `/api/v1/jobs/${upload.job_id}`,
        }),
      ),
    ).toMatchObject({ status: "SUCCEEDED", job_type: "DOCUMENT_IMPORT" });
    expect(
      data(
        await app.inject({
          method: "GET",
          url: `/api/v1/documents/${upload.document_id}`,
        }),
      ),
    ).toMatchObject({
      document_version: {
        document_version_id: upload.document_version_id,
        page_count: 2,
        extraction_profile_version: "1",
      },
    });

    const inspectionDatabase = openDatabase(setup.databasePath, {
      migrationsDirectory,
    });
    const inspectionStorage = new StorageRepository(inspectionDatabase);
    expect(
      inspectionStorage.getDocumentPages(upload.document_version_id),
    ).toEqual([
      {
        documentVersionId: upload.document_version_id,
        pageNumber: 1,
        canonicalPageText: "Research Reading synthetic fixture.\nPage one.",
        pageTextSha256: sha256(
          "Research Reading synthetic fixture.\nPage one.",
        ),
        extractionProfileVersion: "1",
        codePointLength: [..."Research Reading synthetic fixture.\nPage one."]
          .length,
      },
      {
        documentVersionId: upload.document_version_id,
        pageNumber: 2,
        canonicalPageText: "U n i c o d e = c a f Ø",
        pageTextSha256: sha256("U n i c o d e = c a f Ø"),
        extractionProfileVersion: "1",
        codePointLength: [..."U n i c o d e = c a f Ø"].length,
      },
    ]);

    const questionJob = data(
      await app.inject({
        method: "POST",
        url: `/api/v1/document-versions/${upload.document_version_id}/question-plans`,
        payload: questionRequest("default-question-plan"),
      }),
    );
    const questionPayload = inspectionStorage.getJob(questionJob.jobId)
      ?.payload as {
      contextSpans: Array<{ page_number: number; text: string }>;
    };
    expect(questionPayload.contextSpans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          page_number: 1,
          text: "Research Reading synthetic fixture.\nPage one.",
        }),
        expect.objectContaining({
          page_number: 2,
          text: "U n i c o d e = c a f Ø",
        }),
      ]),
    );
    inspectionDatabase.close();

    const questionWorker = createWorkerRuntime(
      "worker_default_question",
      setup.databasePath,
    );
    expect(await questionWorker.jobRuntime.runOnce()).toBe(true);
    questionWorker.database.close();
    expect(
      data(
        await app.inject({
          method: "GET",
          url: `/api/v1/jobs/${questionJob.jobId}`,
        }),
      ),
    ).toMatchObject({ status: "SUCCEEDED", job_type: "QUESTION_PLAN" });
    expect(
      data(
        await app.inject({
          method: "GET",
          url: `/api/v1/document-versions/${upload.document_version_id}/question-plan`,
        }),
      ),
    ).toMatchObject({
      document_version_id: upload.document_version_id,
      questions: expect.arrayContaining([
        expect.objectContaining({
          revision: expect.objectContaining({ text: expect.any(String) }),
        }),
      ]),
    });
    await app.close();
  });

  it("runs the complete Mock browser closure and restores it after reopening", async () => {
    const setup = createSetup();
    const app = createApiServer({
      databasePath: setup.databasePath,
      contentRoot: setup.contentRoot,
    });
    const project = data(
      await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: { name: "HTTP methods" },
      }),
    );
    const upload = data(
      await app.inject({
        method: "POST",
        url: `/api/v1/projects/${project.project_id}/documents`,
        headers: {
          "content-type": "application/pdf",
          "x-filename": "synthetic-text.pdf",
          "idempotency-key": "upload-one",
        },
        payload: await readFile(fixture),
      }),
    );
    expect(upload).toMatchObject({
      document_id: expect.stringMatching(/^doc_/),
      document_version_id: expect.stringMatching(/^docv_/),
      job_id: expect.stringMatching(/^job_/),
    });

    const notReady = await app.inject({
      method: "POST",
      url: `/api/v1/document-versions/${upload.document_version_id}/question-plans`,
      payload: questionRequest("question-before-document"),
    });
    expect(notReady.statusCode).toBe(409);
    expect(error(notReady).code).toBe("DOCUMENT_NOT_READY");

    const worker = createWorkerRuntime("worker_http", setup.databasePath, {
      documentImportHandler: createDocumentImportJobHandler(extractTextPdf),
    });
    expect(await worker.jobRuntime.runOnce()).toBe(true);
    worker.database.close();

    const document = data(
      await app.inject({
        method: "GET",
        url: `/api/v1/documents/${upload.document_id}`,
      }),
    );
    expect(document).toMatchObject({
      document_version: {
        document_version_id: upload.document_version_id,
        page_count: 2,
      },
      extraction_job: { status: "SUCCEEDED" },
    });

    const questionJob = data(
      await app.inject({
        method: "POST",
        url: `/api/v1/document-versions/${upload.document_version_id}/question-plans`,
        payload: questionRequest("question-one"),
      }),
    );
    const questionWorker = createWorkerRuntime(
      "worker_questions",
      setup.databasePath,
    );
    expect(await questionWorker.jobRuntime.runOnce()).toBe(true);
    questionWorker.database.close();
    expect(
      data(
        await app.inject({
          method: "GET",
          url: `/api/v1/jobs/${questionJob.jobId}`,
        }),
      ),
    ).toMatchObject({ status: "SUCCEEDED", job_type: "QUESTION_PLAN" });

    const plan = data(
      await app.inject({
        method: "GET",
        url: `/api/v1/document-versions/${upload.document_version_id}/question-plan`,
      }),
    );
    const question = plan.questions[0];
    expect(question).toMatchObject({ reviewStatus: "DRAFT" });
    const unconfirmedAnswer = await app.inject({
      method: "POST",
      url: `/api/v1/questions/${question.questionId}/answers`,
      payload: answerRequest("answer-before-confirm"),
    });
    expect(unconfirmedAnswer.statusCode).toBe(409);
    expect(error(unconfirmedAnswer).code).toBe("CONFLICT");
    const edited = data(
      await app.inject({
        method: "PATCH",
        url: `/api/v1/questions/${question.questionId}`,
        payload: {
          revision_id: question.currentRevisionId,
          text: "Which method is evaluated in the paper?",
        },
      }),
    );
    const staleQuestion = await app.inject({
      method: "POST",
      url: `/api/v1/questions/${question.questionId}/confirm`,
      payload: { revision_id: question.currentRevisionId },
    });
    expect(staleQuestion.statusCode).toBe(409);
    expect(error(staleQuestion).code).toBe("CONFLICT");
    expect(
      data(
        await app.inject({
          method: "POST",
          url: `/api/v1/questions/${question.questionId}/confirm`,
          payload: { revision_id: edited.currentRevisionId },
        }),
      ),
    ).toMatchObject({ reviewStatus: "CONFIRMED" });

    const insufficientJob = data(
      await app.inject({
        method: "POST",
        url: `/api/v1/questions/${question.questionId}/answers`,
        payload: {
          provider_config: {
            provider: "MOCK",
            fixture_id: "answer-insufficient",
          },
          idempotency_key: "answer-insufficient",
        },
      }),
    );
    const insufficientWorker = createWorkerRuntime(
      "worker_insufficient",
      setup.databasePath,
    );
    expect(await insufficientWorker.jobRuntime.runOnce()).toBe(true);
    insufficientWorker.database.close();
    data(
      await app.inject({
        method: "GET",
        url: `/api/v1/jobs/${insufficientJob.jobId}`,
      }),
    );
    const afterInsufficient = data(
      await app.inject({
        method: "GET",
        url: `/api/v1/projects/${project.project_id}/snapshot`,
      }),
    );
    const insufficient = afterInsufficient.answers.find(
      (candidate: { verificationStatus: string }) =>
        candidate.verificationStatus === "INSUFFICIENT_EVIDENCE",
    );
    expect(insufficient).toBeDefined();
    const insufficientConfirm = await app.inject({
      method: "POST",
      url: `/api/v1/answers/${insufficient.answerId}/confirm`,
      payload: { revision_id: insufficient.currentRevisionId },
    });
    expect(insufficientConfirm.statusCode).toBe(409);

    const answerJob = data(
      await app.inject({
        method: "POST",
        url: `/api/v1/questions/${question.questionId}/answers`,
        payload: answerRequest("answer-one"),
      }),
    );
    const answerWorker = createWorkerRuntime(
      "worker_answers",
      setup.databasePath,
    );
    expect(await answerWorker.jobRuntime.runOnce()).toBe(true);
    answerWorker.database.close();
    data(
      await app.inject({
        method: "GET",
        url: `/api/v1/jobs/${answerJob.jobId}`,
      }),
    );

    const snapshot = data(
      await app.inject({
        method: "GET",
        url: `/api/v1/projects/${project.project_id}/snapshot`,
      }),
    );
    const answer = snapshot.answers.find(
      (candidate: { verificationStatus: string }) =>
        candidate.verificationStatus === "VERIFIED",
    );
    expect(answer).toBeDefined();
    if (!answer) throw new Error("Verified answer was not materialized");
    expect(answer).toMatchObject({
      reviewStatus: "DRAFT",
      verificationStatus: "VERIFIED",
      evidence: [expect.objectContaining({ quote: expect.any(String) })],
    });
    const contextId = `context_${upload.document_version_id.slice(5)}_1`;
    const editedAnswer = data(
      await app.inject({
        method: "PATCH",
        url: `/api/v1/answers/${answer.answerId}`,
        payload: {
          revision_id: answer.currentRevisionId,
          draft: {
            status: "SUCCESS",
            claims: [
              {
                text: "The method is evaluated against the paper evidence.",
                claim_type: "PAPER_FACT",
                candidate_context_span_ids: [contextId],
              },
            ],
          },
        },
      }),
    );
    const staleAnswer = await app.inject({
      method: "POST",
      url: `/api/v1/answers/${answer.answerId}/confirm`,
      payload: { revision_id: answer.currentRevisionId },
    });
    expect(staleAnswer.statusCode).toBe(409);
    expect(error(staleAnswer).code).toBe("CONFLICT");
    expect(
      data(
        await app.inject({
          method: "POST",
          url: `/api/v1/answers/${answer.answerId}/confirm`,
          payload: { revision_id: editedAnswer.currentRevisionId },
        }),
      ),
    ).toMatchObject({ reviewStatus: "CONFIRMED" });
    await app.close();

    const reopened = createApiServer({
      databasePath: setup.databasePath,
      contentRoot: setup.contentRoot,
    });
    const restored = data(
      await reopened.inject({
        method: "GET",
        url: `/api/v1/projects/${project.project_id}/snapshot`,
      }),
    );
    expect(restored).toMatchObject({
      project: { project_id: project.project_id },
      documents: [
        expect.objectContaining({ document_version: expect.any(Object) }),
      ],
    });
    expect(restored.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reviewStatus: "CONFIRMED" }),
        expect.objectContaining({
          verificationStatus: "INSUFFICIENT_EVIDENCE",
        }),
      ]),
    );
    await reopened.close();
  });

  it("returns safe errors, supports insufficient evidence, and never persists session keys", async () => {
    const setup = createSetup();
    const app = createApiServer({
      databasePath: setup.databasePath,
      contentRoot: setup.contentRoot,
    });
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/projects/proj_missing",
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: "/api/v1/jobs/job_missing" }))
        .statusCode,
    ).toBe(404);
    const project = data(
      await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        payload: { name: "Errors" },
      }),
    );
    const invalidUpload = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.project_id}/documents`,
      headers: {
        "content-type": "application/pdf",
        "x-filename": "bad.pdf",
        "idempotency-key": "bad",
      },
      payload: Buffer.from("not a PDF"),
    });
    expect(invalidUpload.statusCode).toBe(400);
    expect(error(invalidUpload).code).toBe("UNSUPPORTED_INPUT");

    const failedUpload = data(
      await app.inject({
        method: "POST",
        url: `/api/v1/projects/${project.project_id}/documents`,
        headers: {
          "content-type": "application/pdf",
          "x-filename": "synthetic-text.pdf",
          "idempotency-key": "failed-import",
        },
        payload: await readFile(fixture),
      }),
    );
    const workerWithoutImport = createWorkerRuntime(
      "worker_without_import",
      setup.databasePath,
      {
        documentImportHandler: async () => {
          throw new Error("test document import failure");
        },
      },
    );
    expect(await workerWithoutImport.jobRuntime.runOnce()).toBe(true);
    workerWithoutImport.database.close();
    const failedJob = data(
      await app.inject({
        method: "GET",
        url: `/api/v1/jobs/${failedUpload.job_id}`,
      }),
    );
    expect(failedJob).toMatchObject({
      status: "FAILED",
      error: { code: "JOB_FAILED" },
    });
    expect(JSON.stringify(failedJob)).not.toContain("sourcePath");

    const sessionKey = "secret-token-must-not-persist";
    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/byok/session-key",
      payload: { api_key: sessionKey },
    });
    expect(registration.body).not.toContain(sessionKey);
    expect(
      readFileSync(setup.databasePath).includes(Buffer.from(sessionKey)),
    ).toBe(false);
    await app.close();
  });
});

function createSetup() {
  const directory = mkdtempSync(join(tmpdir(), "workflow-http-"));
  temporaryDirectories.push(directory);
  return {
    databasePath: join(directory, "workflow.sqlite"),
    contentRoot: join(directory, "content"),
  };
}

function questionRequest(idempotencyKey: string) {
  return {
    document_language: "en",
    provider_config: { provider: "MOCK", fixture_id: "question-default" },
    idempotency_key: idempotencyKey,
  };
}

function answerRequest(idempotencyKey: string) {
  return {
    provider_config: { provider: "MOCK", fixture_id: "answer-success" },
    idempotency_key: idempotencyKey,
  };
}

function data(response: { statusCode: number; json(): unknown }) {
  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  const body = response.json() as { data: unknown };
  // biome-ignore lint/suspicious/noExplicitAny: HTTP transport payload shape varies by route.
  return body.data as any;
}

function error(response: { json(): unknown }) {
  return (response.json() as { error: { code: string } }).error;
}
