import { mkdtemp, readFile, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";
import { extractTextPdf } from "../../../packages/pdf/dist/index.js";

const fixture = fileURLToPath(
  new URL("../../fixtures/pdf/synthetic-text.pdf", import.meta.url),
);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("V1 local HTTP smoke", () => {
  it("runs real HTTP + Worker + SQLite + PDF + exact Evidence through stage completion", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "research-reading-v1-smoke-"),
    );
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "v1-smoke.sqlite");
    const contentRoot = join(directory, "content");
    const pdf = await readFile(fixture);
    const canonicalDocument = await extractTextPdf(pdf);
    const app = createApiServer({ databasePath, contentRoot });
    const worker = createWorkerRuntime("worker_v1_http_smoke", databasePath);

    try {
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const project = await jsonData(
        fetch(`${baseUrl}/api/v1/projects`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "V1 HTTP smoke" }),
        }),
      );
      const upload = await jsonData(
        fetch(`${baseUrl}/api/v1/projects/${project.project_id}/documents`, {
          method: "POST",
          headers: {
            "content-type": "application/pdf",
            "x-filename": "synthetic-text.pdf",
            "idempotency-key": "v1-smoke-upload",
          },
          body: new Uint8Array(pdf),
        }),
      );
      await drain(worker);
      expect(
        await jsonData(fetch(`${baseUrl}/api/v1/jobs/${upload.job_id}`)),
      ).toMatchObject({ status: "SUCCEEDED", job_type: "DOCUMENT_IMPORT" });

      const servedPdf = await fetch(
        `${baseUrl}/api/v1/document-versions/${upload.document_version_id}/content`,
      );
      expect(servedPdf.status).toBe(200);
      expect(servedPdf.headers.get("content-type")).toContain(
        "application/pdf",
      );
      expect(Buffer.from(await servedPdf.arrayBuffer())).toEqual(pdf);

      const created = await jsonData(
        fetch(`${baseUrl}/api/v1/guided-learning/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            project_id: project.project_id,
            document_version_id: upload.document_version_id,
            learning_goal: "理解论文的方法和原文证据",
            provider_config: {
              provider: "MOCK",
              fixture_id: "guided-learning-v1",
            },
          }),
        }),
      );
      await drain(worker);
      let session = await getSession(baseUrl, created.session.session_id);
      expect(session.state).toBe("AWAITING_DIRECTION_SELECTION");

      session = await command(
        baseUrl,
        session.session_id,
        "SELECT_DIRECTION",
        { direction_id: session.candidate_directions[0].direction_id },
        "v1-smoke-select",
      );
      expect(session.state).toBe("ROUTE_LOCKED");
      session = await command(
        baseUrl,
        session.session_id,
        "START_STAGE",
        { stage_id: "UNDERSTAND" },
        "v1-smoke-start",
      );
      expect(session.state).toBe("QUESTIONS_GENERATING");
      await drain(worker);

      for (const order of [1, 2, 3]) {
        session = await getSession(baseUrl, session.session_id);
        const question = session.questions.find(
          (candidate: { order: number }) => candidate.order === order,
        );
        session = await command(
          baseUrl,
          session.session_id,
          "SUBMIT_ANSWER",
          {
            question_id: question.question_id,
            question_order: order,
            answer: `第 ${order} 题的本地 smoke 回答`,
          },
          `v1-smoke-answer-${order}`,
        );
        expect(session.state).toBe("ANSWER_SUBMITTED");
        await drain(worker);
        session = await getSession(baseUrl, session.session_id);
        expect(session.state).toBe("FEEDBACK_READY");
        const feedbackQuestion = session.questions.find(
          (candidate: { order: number }) => candidate.order === order,
        );
        const evidence = feedbackQuestion.evidence[0];
        expect(evidence.verification_status).toBe("VERIFIED");
        const canonicalPage = canonicalDocument.pages.find(
          (page) => page.page_number === evidence.page_number,
        );
        expect(
          canonicalPage?.canonical_page_text.includes(evidence.quote),
        ).toBe(true);
        expect(feedbackQuestion.reference_answer.claims[0]).toMatchObject({
          claim_type: "PAPER_FACT",
          evidence_refs: [evidence.evidence_span_id],
        });

        session = await command(
          baseUrl,
          session.session_id,
          "CONFIRM_QUESTION",
          {
            question_id: question.question_id,
            question_order: order,
          },
          `v1-smoke-confirm-${order}`,
        );
        expect(session.state).toBe("QUESTION_COMPLETED");
        session = await command(
          baseUrl,
          session.session_id,
          "ADVANCE_QUESTION",
          {
            question_id: question.question_id,
            question_order: order,
          },
          `v1-smoke-advance-${order}`,
        );
      }

      expect(session.state).toBe("SUMMARY_GENERATING");
      await drain(worker);
      session = await getSession(baseUrl, session.session_id);
      expect(session.state).toBe("STAGE_COMPLETED");
      expect(session.stage_summary).toMatchObject({
        status: "GENERATED",
        completed_question_orders: [1, 2, 3],
      });
    } finally {
      worker.database.close();
      await app.close();
    }
  });
});

async function drain(worker: ReturnType<typeof createWorkerRuntime>) {
  while (await worker.jobRuntime.runOnce()) {}
}

async function getSession(baseUrl: string, sessionId: string) {
  return jsonData(
    fetch(`${baseUrl}/api/v1/guided-learning/sessions/${sessionId}`),
  );
}

async function command(
  baseUrl: string,
  sessionId: string,
  event: string,
  payload: unknown,
  idempotencyKey: string,
) {
  const result = await jsonData(
    fetch(`${baseUrl}/api/v1/guided-learning/sessions/${sessionId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contract_version: "guided-learning.v1",
        event,
        payload,
        idempotency_key: idempotencyKey,
      }),
    }),
  );
  return result.session;
}

async function jsonData(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  const body = (await response.json()) as {
    data?: unknown;
    error?: { code: string; message: string };
  };
  if (!response.ok || body.data === undefined)
    throw new Error(
      `HTTP ${response.status}: ${body.error?.code ?? "MISSING_DATA"} ${body.error?.message ?? ""}`,
    );
  // biome-ignore lint/suspicious/noExplicitAny: local smoke traverses several stable api.v1 data variants.
  return body.data as any;
}
