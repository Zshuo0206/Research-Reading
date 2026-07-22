import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkerRuntime } from "../../../apps/worker/src/runtime.js";
import {
  runWorkerLoop,
  watchWorkerStopFile,
} from "../../../apps/worker/src/worker-loop.js";
import { runWorkerService } from "../../../apps/worker/src/worker-service.js";
import {
  openDatabase,
  StorageRepository,
} from "../../../packages/storage/src/index.js";

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

  it("keeps the service open until the current job finishes, then closes and stops once", async () => {
    const controller = new AbortController();
    let releaseCurrentJob!: () => void;
    let reportEntered!: () => void;
    const entered = new Promise<void>((resolveEntered) => {
      reportEntered = resolveEntered;
    });
    const currentJob = new Promise<void>((resolveCurrentJob) => {
      releaseCurrentJob = resolveCurrentJob;
    });
    let calls = 0;
    let closeCalls = 0;
    let stoppedCalls = 0;
    let settled = false;
    const service = runWorkerService(
      {
        jobRuntime: {
          runOnce: async () => {
            calls += 1;
            reportEntered();
            await currentJob;
            return true;
          },
        },
        database: {
          close: () => {
            closeCalls += 1;
          },
        },
      },
      {
        signal: controller.signal,
        onStopped: () => {
          stoppedCalls += 1;
        },
      },
    ).then(() => {
      settled = true;
    });
    await entered;
    controller.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(closeCalls).toBe(0);
    releaseCurrentJob();
    await service;
    expect(calls).toBe(1);
    expect(closeCalls).toBe(1);
    expect(stoppedCalls).toBe(1);
  });

  it("watches only for stop-file existence and disposes after requesting stop", async () => {
    const directory = mkdtempSync(join(tmpdir(), "worker-stop-file-"));
    temporaryDirectories.push(directory);
    const stopFile = join(directory, "worker.stop");
    const controller = new AbortController();
    let checks = 0;
    let reportStopped!: () => void;
    const stopped = new Promise<void>((resolveStopped) => {
      reportStopped = resolveStopped;
    });
    const dispose = watchWorkerStopFile(
      stopFile,
      () => {
        controller.abort();
        reportStopped();
      },
      {
        intervalMs: 5,
        fileExists: (path) => {
          checks += 1;
          return existsSync(path);
        },
      },
    );
    expect(controller.signal.aborted).toBe(false);
    writeFileSync(stopFile, "content-is-never-read", "utf8");
    await stopped;
    expect(controller.signal.aborted).toBe(true);
    const checksAfterStop = checks;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
    expect(checks).toBe(checksAfterStop);
    dispose();
  });

  it("isolates transient runOnce failures and applies bounded backoff", async () => {
    const controller = new AbortController();
    const waits: number[] = [];
    const retries: Array<{
      consecutiveFailures: number;
      retryDelayMs: number;
    }> = [];
    let calls = 0;
    await runWorkerLoop(
      fakeRuntime(async () => {
        calls += 1;
        if (calls < 3) throw new Error("queue unavailable with private path");
        controller.abort();
        return true;
      }),
      {
        signal: controller.signal,
        errorDelayMs: 100,
        maxErrorDelayMs: 150,
        sleep: async (delayMs) => {
          waits.push(delayMs);
        },
        onLoopError: ({ consecutiveFailures, retryDelayMs }) => {
          retries.push({ consecutiveFailures, retryDelayMs });
        },
      },
    );
    expect(calls).toBe(3);
    expect(waits).toEqual([100, 150]);
    expect(retries).toEqual([
      { consecutiveFailures: 1, retryDelayMs: 100 },
      { consecutiveFailures: 2, retryDelayMs: 150 },
    ]);
  });

  it("closes the database once and reports stopped on a fatal loop configuration error", async () => {
    let closeCalls = 0;
    let stoppedCalls = 0;
    await expect(
      runWorkerService(
        {
          jobRuntime: { runOnce: async () => false },
          database: {
            close: () => {
              closeCalls += 1;
            },
          },
        },
        {
          idleDelayMs: -1,
          onStopped: () => {
            stoppedCalls += 1;
          },
        },
      ),
    ).rejects.toThrow("Worker idle delay");
    expect(closeCalls).toBe(1);
    expect(stoppedCalls).toBe(1);
  });

  it("does not wait for backoff after an abort requested by the retry observer", async () => {
    const controller = new AbortController();
    let calls = 0;
    await runWorkerLoop(
      fakeRuntime(async () => {
        calls += 1;
        throw new Error("database temporarily locked");
      }),
      {
        signal: controller.signal,
        errorDelayMs: 10000,
        maxErrorDelayMs: 10000,
        onLoopError: () => controller.abort(),
      },
    );
    expect(calls).toBe(1);
  });

  it("keeps smoke mode immediate and does not run the loop", async () => {
    let calls = 0;
    let closeCalls = 0;
    let stoppedCalls = 0;
    await runWorkerService(
      {
        jobRuntime: {
          runOnce: async () => {
            calls += 1;
            return false;
          },
        },
        database: {
          close: () => {
            closeCalls += 1;
          },
        },
      },
      {
        smoke: true,
        onStopped: () => {
          stoppedCalls += 1;
        },
      },
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
    const directory = mkdtempSync(
      join(tmpdir(), "research-reading-worker-loop-"),
    );
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "worker.sqlite");
    let handled = 0;
    const worker = createWorkerRuntime(
      "worker-loop-integration",
      databasePath,
      {
        documentImportHandler: async () => {
          handled += 1;
          return { imported: true };
        },
      },
    );
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
    expect(observerRepository.getJob("worker_loop_job")).toMatchObject({
      state: "SUCCEEDED",
    });
    observerDatabase.close();
  });
});
