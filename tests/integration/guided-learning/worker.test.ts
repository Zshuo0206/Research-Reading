import { readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRuntime } from "../../../apps/api/src/runtime.js";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";
import { describe, expect, it } from "vitest";

const fixture = fileURLToPath(
  new URL("../../fixtures/pdf/synthetic-text.pdf", import.meta.url),
);

async function drain(worker: ReturnType<typeof createWorkerRuntime>) {
  while (await worker.jobRuntime.runOnce()) {}
}

describe("Guided Learning Worker generation jobs", () => {
  it("registers all four operations and runs a real-PDF Mock flow idempotently", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rr-guided-worker-"));
    const databasePath = join(directory, "guided.sqlite");
    const api = createApiRuntime(databasePath, join(directory, "content"));
    const worker = createWorkerRuntime("guided-worker-test", databasePath);
    const bytes = await readFile(fixture);
    const projectId = "proj_guided_worker";
    api.storage.createProject(projectId, "Guided Worker");
    const importJob = await api.documentIngest.upload({
      projectId,
      title: "synthetic-text.pdf",
      file: {
        filename: "synthetic-text.pdf",
        contentType: "application/pdf",
        bytes,
      },
      idempotencyKey: "guided-pdf-import",
    });
    await drain(worker);
    api.workflowHttp.getJob(importJob.jobId);

    expect(Object.keys(worker.handlers).filter((key) => key.startsWith("GUIDED_LEARNING"))).toEqual([
      "GUIDED_LEARNING_DIRECTION_GENERATION",
      "GUIDED_LEARNING_QUESTION_GENERATION",
      "GUIDED_LEARNING_FEEDBACK_GENERATION",
      "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION",
    ]);

    const created = api.guidedLearningHandlers.create({
      project_id: projectId,
      document_version_id: importJob.payload.documentVersionId,
      learning_goal: "理解论文方法",
    });
    expect(created.session.state).toBe("CREATED");
    await drain(worker);
    const directions = api.guidedLearningRuntime.getSession(
      created.session.session_id,
    );
    expect(directions.state).toBe("AWAITING_DIRECTION_SELECTION");
    expect(directions.candidate_directions).toHaveLength(2);

    const command = (event: string, payload: unknown, key: string) =>
      api.guidedLearningRuntime.executeCommand({
        session_id: created.session.session_id,
        contract_version: "guided-learning.v1",
        event,
        payload,
        idempotency_key: key,
      });
    command(
      "SELECT_DIRECTION",
      { direction_id: directions.candidate_directions[0]?.direction_id },
      "guided-select",
    );
    command("START_STAGE", { stage_id: "UNDERSTAND" }, "guided-start");
    await drain(worker);
    expect(api.guidedLearningRuntime.getSession(created.session.session_id).state).toBe(
      "AWAITING_ANSWER",
    );

    for (const order of [1, 2, 3]) {
      const before = api.guidedLearningRuntime.getSession(created.session.session_id);
      const question = before.questions?.find((item) => item.order === order);
      command(
        "SUBMIT_ANSWER",
        {
          question_id: question?.question_id,
          question_order: order,
          answer: `第 ${order} 题回答`,
        },
        `guided-answer-${order}`,
      );
      await drain(worker);
      const feedback = api.guidedLearningRuntime.getSession(created.session.session_id);
      expect(feedback.state).toBe("FEEDBACK_READY");
      const current = feedback.questions?.find((item) => item.order === order);
      const evidence = current && "evidence" in current ? current.evidence[0] : undefined;
      expect(evidence?.verification_status).toBe("VERIFIED");
      const page = api.storage.getDocumentPages(importJob.payload.documentVersionId)[0];
      expect(page?.canonicalPageText.includes(evidence?.quote ?? "")).toBe(true);
      expect(evidence?.page_text_sha256).toBe(page?.pageTextSha256);
      command(
        "CONFIRM_QUESTION",
        { question_id: question?.question_id, question_order: order },
        `guided-confirm-${order}`,
      );
      command(
        "ADVANCE_QUESTION",
        { question_id: question?.question_id, question_order: order },
        `guided-advance-${order}`,
      );
      if (order < 3) {
        expect(api.guidedLearningRuntime.getSession(created.session.session_id).state).toBe(
          "AWAITING_ANSWER",
        );
      }
      if (order === 3) await drain(worker);
    }

    expect(api.guidedLearningRuntime.getSession(created.session.session_id).state).toBe(
      "STAGE_COMPLETED",
    );
    const jobKinds = (
      api.database
        .prepare("SELECT kind FROM jobs WHERE kind LIKE 'GUIDED_LEARNING_%' ORDER BY kind")
        .all() as Array<{ kind: string }>
    ).map((row) => row.kind);
    expect(jobKinds).toEqual([
      "GUIDED_LEARNING_DIRECTION_GENERATION",
      "GUIDED_LEARNING_FEEDBACK_GENERATION",
      "GUIDED_LEARNING_FEEDBACK_GENERATION",
      "GUIDED_LEARNING_FEEDBACK_GENERATION",
      "GUIDED_LEARNING_QUESTION_GENERATION",
      "GUIDED_LEARNING_STAGE_SUMMARY_GENERATION",
    ]);

    const beforeReplay = api.guidedLearningRuntime.getSession(created.session.session_id);
    const replay = command(
      "SELECT_DIRECTION",
      { direction_id: directions.candidate_directions[0]?.direction_id },
      "guided-select",
    );
    expect(replay.outcome).toBe("APPLIED");
    expect(replay.session.session_revision).toBe(3);
    expect(api.guidedLearningRuntime.getSession(created.session.session_id).session_revision).toBe(
      beforeReplay.session_revision,
    );
    api.database.close();
    worker.database.close();
  });

  it("rejects invalid, missing-session and stale-revision payloads, and retries failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rr-guided-worker-boundary-"));
    const databasePath = join(directory, "guided.sqlite");
    const api = createApiRuntime(databasePath);
    api.storage.createProject("proj_boundary", "Boundary");
    api.storage.createDocument("doc_boundary", "proj_boundary", "paper.pdf");
    const text = "Canonical method evidence for the guided learning worker.";
    const hash = createHash("sha256").update(text).digest("hex");
    api.storage.createDocumentVersion({
      documentVersionId: "docv_boundary",
      documentId: "doc_boundary",
      sourceSha256: hash,
      pageCount: 1,
      extractionProfileVersion: "pdf-text-v1",
    });
    api.storage.saveDocumentPages("docv_boundary", [
      {
        pageNumber: 1,
        canonicalPageText: text,
        pageTextSha256: hash,
        extractionProfileVersion: "pdf-text-v1",
        codePointLength: Array.from(text).length,
      },
    ]);
    let failOnce = true;
    const gateway = {
      async invoke(_request: unknown) {
        if (failOnce) {
          failOnce = false;
          throw new Error("temporary model outage");
        }
        return {
          schema_version: "model-gateway.v1",
          message_kind: "RESPONSE",
          operation: "GENERATE_QUESTION_PLAN",
          output: {
            document_language: "zh-CN",
            retrieval_queries: [],
            retrieval_terms: [],
            questions: [{ text: "方法如何支持结论？" }],
          },
        };
      },
    };
    const worker = createWorkerRuntime("boundary-worker", databasePath, {
      guidedLearningGateway: gateway,
    });
    const created = api.guidedLearningHandlers.create({
      project_id: "proj_boundary",
      document_version_id: "docv_boundary",
      learning_goal: "理解方法",
    });
    const directionJob = api.storage.getJob(created.job_id);
    const directionHandler = worker.handlers.GUIDED_LEARNING_DIRECTION_GENERATION;
    await expect(directionHandler?.({})).rejects.toThrow(/payload/);
    await expect(
      directionHandler?.({
        ...(directionJob?.payload as Record<string, unknown>),
        session_id: "learning_missing",
      }),
    ).rejects.toThrow(/Session not found/);

    api.guidedLearningRuntime.generateDirections(created.session.session_id);
    api.guidedLearningRuntime.executeCommand({
      session_id: created.session.session_id,
      contract_version: "guided-learning.v1",
      event: "SELECT_DIRECTION",
      payload: { direction_id: "direction_method" },
      idempotency_key: "boundary-select",
    });
    await expect(directionHandler?.(directionJob?.payload)).rejects.toThrow(/generation boundary/);
    expect(api.guidedLearningRuntime.getSession(created.session.session_id).state).toBe(
      "ROUTE_LOCKED",
    );

    await worker.jobRuntime.runOnce();
    const retryJob = api.guidedLearningRuntime.requestDirectionsGeneration({
      project_id: "proj_boundary",
      document_version_id: "docv_boundary",
      learning_goal: "重试方法",
    });
    await worker.jobRuntime.runOnce();
    expect(api.guidedLearningRuntime.getSession(retryJob.session.session_id).state).toBe(
      "RETRYABLE_FAILURE",
    );
    const retried = api.guidedLearningRuntime.executeCommand({
      session_id: retryJob.session.session_id,
      contract_version: "guided-learning.v1",
      event: "RETRY",
      payload: {},
      idempotency_key: "boundary-retry",
    });
    expect(retried.session.state).toBe("CREATED");
    await worker.jobRuntime.runOnce();
    expect(api.guidedLearningRuntime.getSession(retryJob.session.session_id).state).toBe(
      "AWAITING_DIRECTION_SELECTION",
    );
    worker.database.close();
    api.database.close();
  });
});
