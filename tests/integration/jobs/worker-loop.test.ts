import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";
import { runWorkerLoop } from "../../../apps/worker/src/worker-loop.js";
import { runWorkerService } from "../../../apps/worker/src/worker-service.js";
import { openDatabase, StorageRepository } from "../../../packages/storage/src/index.js";

const migrationDirectory = resolve("apps/api/migrations");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fakeRuntime(runOnce: () => Promise<boolean> | boolean) {
  return {
    jobRuntime: { runOnce: async () => runOnce() },
    database: { close: () => undefined },
  };
}

describe("Worker polling loop", () => {
  it("calls runOnce and stops when requested", async () => {
    const controller = new AbortController();
    let calls = 0;
    await runWorkerLoop(
      fakeRuntime(async () => {
        calls += 1;
        controller.abort();
        return true;
      }),
      { signal: controller.signal },
    );
    expect(calls).toBe(1);
  });

  it("processes multiple jobs sequentially", async () => {
    const controller = new AbortController();
    const order: number[] = [];
    await runWorkerLoop(
      fakeRuntime(async () => {
        order.push(order.length + 1);
        if (order.length === 3) controller.abort();
        return true;
      }),
      { signal: controller.signal },
    );
    expect(order).toEqual([1, 2, 3]);
  });

  it("waits during idle instead of spinning", async () => {
    const controller = new AbortController();
    const waits: number[] = [];
    await runWorkerLoop(
      fakeRuntime(async () => false),
      {
        signal: controller.signal,
        sleep: async (delayMs) => {
          waits.push(delayMs);
          controller.abort();
        },
      },
    );
    expect(waits).toEqual([250]);
  });

  it("does not claim another job after stop is requested", async () => {
    const controller = new AbortController();
    let calls = 0;
    await runWorkerLoop(
      fakeRuntime(async () => {
        calls += 1;
        controller.abort();
        return true;
      }),
      { signal: controller.signal },
    );
    expect(calls).toBe(1);
  });

  it("waits for the current job before exiting", async () => {
    const controller = new AbortController();
    let releaseCurrentJob!: () => void;
    let calls = 0;
    let settled = false;
    const currentJob = new Promise<void>((resolveCurrentJob) => {
      releaseCurrentJob = resolveCurrentJob;
    });
    const loop = runWorkerLoop(
      fakeRuntime(async () => {
        calls += 1;
        await currentJob;
        return true;
      }),
      { signal: controller.signal },
    ).then(() => {
      settled = true;
    });
    await Promise.resolve();
    controller.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    releaseCurrentJob();
    await loop;
    expect(calls).toBe(1);
    expect(settled).toBe(true);
  });

  it("closes the database once on a fatal loop error", async () => {
    let closeCalls = 0;
    await expect(
      runWorkerService(
        {
          jobRuntime: { runOnce: async () => { throw new Error("queue unavailable"); } },
          database: { close: () => { closeCalls += 1; } },
        },
        { signal: new AbortController().signal },
      ),
    ).rejects.toThrow("queue unavailable");
    expect(closeCalls).toBe(1);
  });

  it("keeps smoke mode immediate and does not run the loop", async () => {
    let calls = 0;
    let closeCalls = 0;
    let stoppedCalls = 0;
    await runWorkerService(
      {
        jobRuntime: { runOnce: async () => { calls += 1; return false; } },
        database: { close: () => { closeCalls += 1; } },
      },
      { smoke: true, onStopped: () => { stoppedCalls += 1; } },
    );
    expect(calls).toBe(0);
    expect(closeCalls).toBe(1);
    expect(stoppedCalls).toBe(0);
  });

  it("keeps non-smoke service alive until an explicit stop", async () => {
    const controller = new AbortController();
    let calls = 0;
    const service = runWorkerService(
      fakeRuntime(async () => {
        calls += 1;
        return false;
      }),
      { signal: controller.signal, idleDelayMs: 1 },
    );
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    expect(calls).toBeGreaterThan(0);
    controller.abort();
    await service;
  });

  it("consumes a real SQLite job through the formal Worker loop", async () => {
    const directory = mkdtempSync(join(tmpdir(), "research-reading-worker-loop-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "worker.sqlite");
    let handled = 0;
    const worker = createWorkerRuntime("worker-loop-integration", databasePath, {
      documentImportHandler: async () => {
        handled += 1;
        return { imported: true };
      },
    });
    const repository = new StorageRepository(worker.database);
    repository.createJob({
      jobId: "worker_loop_job",
      kind: "DOCUMENT_IMPORT",
      payload: { documentVersionId: "docv_worker_loop" },
      idempotencyKey: "worker-loop-job",
    });
    const controller = new AbortController();
    const service = runWorkerService(worker, {
      signal: controller.signal,
      idleDelayMs: 1,
      sleep: async () => controller.abort(),
    });
    await service;
    const observerDatabase = openDatabase(databasePath, {
      migrationsDirectory: migrationDirectory,
    });
    const observerRepository = new StorageRepository(observerDatabase);
    expect(handled).toBe(1);
    expect(observerRepository.getJob("worker_loop_job")).toMatchObject({ state: "SUCCEEDED" });
    observerDatabase.close();
  });
});
