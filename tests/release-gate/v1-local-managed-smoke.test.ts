import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import {
  openDatabase,
  StorageRepository,
} from "../../packages/storage/dist/index.js";

const windowsIt = process.platform === "win32" ? it : it.skip;
const repoRoot = resolve(".");
const statePath = join(repoRoot, "tmp", "v1-local", "processes.json");
const runsRoot = join(repoRoot, "tmp", "v1-local", "runs");
const productionWorkerPath = join(
  repoRoot,
  "apps",
  "worker",
  "dist",
  "worker.js",
);

describe("V1 managed local process release gate", () => {
  windowsIt(
    "runs the normal API, Web and production Worker lifecycle",
    async () => {
      await requireManagedEnvironment();
      const temporaryDirectory = createTemporaryDirectory("normal");
      const databasePath = join(temporaryDirectory, "managed.sqlite");
      const contentRoot = join(temporaryDirectory, "content");
      let runDirectory: string | undefined;
      let processRecords: ManagedState["processes"] = [];
      let cleanupFailure: string | undefined;
      try {
        const started = runScript("start-v1-local.ps1", [
          "-DatabasePath",
          databasePath,
          "-ContentRoot",
          contentRoot,
        ]);
        expect(started.status, diagnostic(started)).toBe(0);
        expect(started.stdout.indexOf("api: healthy")).toBeGreaterThanOrEqual(
          0,
        );
        expect(started.stdout.indexOf("web: healthy")).toBeGreaterThan(
          started.stdout.indexOf("api: healthy"),
        );
        expect(existsSync(statePath)).toBe(true);

        const state = readState();
        runDirectory = resolve(state.run_directory);
        processRecords = state.processes;
        expect(state.lifecycle_status).toBe("READY");
        expect(state.worker_ready_observed).toBe(true);
        expect(resolve(state.worker_entrypoint)).toBe(
          resolve(productionWorkerPath),
        );
        expect(runDirectory.startsWith(resolve(runsRoot) + sep)).toBe(true);
        expect(readJsonEvents(state.logs.worker_stdout)).toContainEqual(
          expect.objectContaining({
            event: "worker_platform_shell_ready",
            accepts_jobs: true,
            readiness_verified: expect.arrayContaining([
              "database",
              "migrations",
              "handlers",
            ]),
          }),
        );

        const checked = runScript("check-v1-local.ps1");
        expect(checked.status, diagnostic(checked)).toBe(0);
        expect(checked.stdout).toContain("worker ready: verified");
        expect(checked.stdout).toContain("V1 local status: healthy");

        const stopped = runScript("stop-v1-local.ps1");
        expect(stopped.status, diagnostic(stopped)).toBe(0);
        assertManagedStopOrder(stopped.stdout);
        expect(existsSync(statePath)).toBe(false);
        expect(existsSync(databasePath)).toBe(true);
        expect(existsSync(contentRoot)).toBe(true);
        expect(countRunningJobs(databasePath)).toBe(0);
        expect(readJsonEvents(state.logs.worker_stdout)).toContainEqual(
          expect.objectContaining({
            event: "worker_platform_shell_stopped",
            signal: "CONTROL_FILE",
          }),
        );
        for (const record of processRecords)
          expect(isProcessAlive(record.pid)).toBe(false);
      } finally {
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt(
    "contains a pre-ready worker_start_failed exit without CONTROL_FILE evidence",
    async () => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory("pre-ready");
      const databasePath = join(temporaryDirectory, "pre-ready.sqlite");
      const workerEntrypoint = join(temporaryDirectory, "pre-ready-worker.mjs");
      writeFileSync(workerEntrypoint, preReadyFailureWorkerFixture(), "utf8");
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const result = runScript(
          "start-v1-local.ps1",
          [
            "-DatabasePath",
            databasePath,
            "-ContentRoot",
            join(temporaryDirectory, "content"),
          ],
          testEnvironment(workerEntrypoint),
        );
        expect(result.status).not.toBe(0);
        expect(result.stdout).toContain("managed lifecycle: STARTING_WORKER");
        expect(result.stdout).toContain(
          "worker: failed before ready; API and Web cleaned up safely",
        );
        expect(result.stdout).not.toContain(
          "worker: stopped gracefully during startup rollback",
        );
        expect(existsSync(statePath)).toBe(false);
        runDirectory = findNewRunDirectory(beforeRuns);
        expect(
          readJsonEvents(join(runDirectory, "worker.stderr.log")),
        ).toContainEqual(
          expect.objectContaining({ event: "worker_start_failed" }),
        );
        expect(
          readJsonEvents(join(runDirectory, "worker.stdout.log")),
        ).not.toContainEqual(
          expect.objectContaining({
            event: "worker_platform_shell_stopped",
            signal: "CONTROL_FILE",
          }),
        );
        await expectManagedPortsAvailable();
      } finally {
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt(
    "persists API ownership before a controlled Web pre-start failure and cleans it",
    async () => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory("before-web");
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const result = runScript(
          "start-v1-local.ps1",
          [
            "-DatabasePath",
            join(temporaryDirectory, "before-web.sqlite"),
            "-ContentRoot",
            join(temporaryDirectory, "content"),
          ],
          {
            V1_LOCAL_TEST_MODE: "1",
            V1_LOCAL_TEST_FAIL_PHASE: "BEFORE_WEB_START",
          },
        );
        expect(result.status).not.toBe(0);
        expect(result.stdout).toContain("managed lifecycle: STARTING_API");
        expect(result.stdout).not.toContain("managed lifecycle: STARTING_WEB");
        expect(existsSync(statePath)).toBe(false);
        runDirectory = findNewRunDirectory(beforeRuns);
        expect(existsSync(join(runDirectory, "worker.stdout.log"))).toBe(false);
        await expectManagedPortsAvailable();
      } finally {
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt(
    "persists API and Web ownership before a controlled Worker pre-create failure and cleans both",
    async () => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory("before-worker");
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const result = runScript(
          "start-v1-local.ps1",
          [
            "-DatabasePath",
            join(temporaryDirectory, "before-worker.sqlite"),
            "-ContentRoot",
            join(temporaryDirectory, "content"),
          ],
          {
            V1_LOCAL_TEST_MODE: "1",
            V1_LOCAL_TEST_FAIL_PHASE: "BEFORE_WORKER_START",
          },
        );
        expect(result.status).not.toBe(0);
        expect(result.stdout).toContain("managed lifecycle: STARTING_API");
        expect(result.stdout).toContain("managed lifecycle: STARTING_WEB");
        expect(result.stdout).not.toContain(
          "managed lifecycle: STARTING_WORKER",
        );
        expect(existsSync(statePath)).toBe(false);
        runDirectory = findNewRunDirectory(beforeRuns);
        expect(existsSync(join(runDirectory, "worker.stdout.log"))).toBe(false);
        await expectManagedPortsAvailable();
      } finally {
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt(
    "rolls back after a real JobRuntime claim without claiming a second Job",
    async () => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory("claimed-job");
      const databasePath = join(temporaryDirectory, "claimed-job.sqlite");
      const releaseFile = join(temporaryDirectory, "release-job");
      const rollbackTrigger = join(temporaryDirectory, "rollback-trigger");
      const workerEntrypoint = join(temporaryDirectory, "claimed-worker.mjs");
      createQueuedJobs(databasePath, 2);
      writeFileSync(
        workerEntrypoint,
        realJobWorkerFixture({ releaseFile }),
        "utf8",
      );
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const started = spawnScript(
          "start-v1-local.ps1",
          [
            "-DatabasePath",
            databasePath,
            "-ContentRoot",
            join(temporaryDirectory, "content"),
          ],
          testEnvironment(workerEntrypoint, rollbackTrigger),
        );
        const readyState = await waitForState(
          (state) =>
            state.lifecycle_status === "READY" &&
            readJob(databasePath, "managed-job-1").state === "RUNNING",
          45_000,
        );
        runDirectory = readyState.run_directory;
        expect(readyState.worker_ready_observed).toBe(true);
        expect(readyState.processes.map((record) => record.role)).toEqual([
          "api",
          "web",
          "worker",
        ]);

        touch(rollbackTrigger);
        await waitForCondition(
          () => existsSync(readyState.worker_stop_file),
          10_000,
          "startup rollback control file",
        );
        expect(readJob(databasePath, "managed-job-1").state).toBe("RUNNING");
        touch(releaseFile);
        const result = await started.completed;
        expect(result.status).not.toBe(0);
        expect(result.stdout).toContain(
          "worker: stopped gracefully during startup rollback",
        );
        assertManagedStopOrder(result.stdout);
        expect(existsSync(statePath)).toBe(false);
        expect(readJob(databasePath, "managed-job-1")).toMatchObject({
          state: "SUCCEEDED",
          attempt: 1,
        });
        expect(readJob(databasePath, "managed-job-2")).toMatchObject({
          state: "QUEUED",
          attempt: 0,
        });
        expect(countRunningJobs(databasePath)).toBe(0);
        expect(readJsonEvents(readyState.logs.worker_stdout)).toContainEqual({
          event: "worker_platform_shell_stopped",
          signal: "CONTROL_FILE",
        });
        await expectManagedPortsAvailable();
      } finally {
        runDirectory ??= findOptionalNewRunDirectory(beforeRuns);
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt(
    "preserves pending state while a real claimed Job exceeds rollback timeout",
    async () => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory("rollback-timeout");
      const databasePath = join(temporaryDirectory, "timeout.sqlite");
      const releaseFile = join(temporaryDirectory, "release-job");
      const rollbackTrigger = join(temporaryDirectory, "rollback-trigger");
      const workerEntrypoint = join(temporaryDirectory, "timeout-worker.mjs");
      createQueuedJobs(databasePath, 2);
      writeFileSync(
        workerEntrypoint,
        realJobWorkerFixture({ releaseFile }),
        "utf8",
      );
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const started = spawnScript(
          "start-v1-local.ps1",
          [
            "-DatabasePath",
            databasePath,
            "-ContentRoot",
            join(temporaryDirectory, "content"),
            "-WorkerStopTimeoutSeconds",
            "1",
          ],
          testEnvironment(workerEntrypoint, rollbackTrigger),
        );
        const readyState = await waitForState(
          (state) =>
            state.lifecycle_status === "READY" &&
            readJob(databasePath, "managed-job-1").state === "RUNNING",
          45_000,
        );
        runDirectory = readyState.run_directory;
        touch(rollbackTrigger);
        const result = await started.completed;
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(
          "may still be completing its current Job",
        );

        const pendingState = readState();
        expect(pendingState.lifecycle_status).toBe("START_FAILED_STOP_PENDING");
        expect(pendingState.worker_ready_observed).toBe(true);
        expect(existsSync(pendingState.worker_stop_file)).toBe(true);
        for (const role of ["api", "web"]) {
          const record = pendingState.processes.find(
            (item) => item.role === role,
          );
          expect(record).toBeDefined();
          expect(isProcessAlive(record?.pid ?? -1)).toBe(true);
        }
        expect(readJob(databasePath, "managed-job-1").state).toBe("RUNNING");

        const checked = runScript("check-v1-local.ps1");
        expect(checked.status).not.toBe(0);
        expect(checked.stdout).toContain(
          "V1 local status: startup rollback pending",
        );

        touch(releaseFile);
        await waitForEvent(
          pendingState.logs.worker_stdout,
          "worker_platform_shell_stopped",
          10_000,
        );
        const stopped = runScript("stop-v1-local.ps1");
        expect(stopped.status, diagnostic(stopped)).toBe(0);
        assertManagedStopOrder(stopped.stdout);
        expect(existsSync(statePath)).toBe(false);
        expect(readJob(databasePath, "managed-job-1")).toMatchObject({
          state: "SUCCEEDED",
          attempt: 1,
        });
        expect(readJob(databasePath, "managed-job-2")).toMatchObject({
          state: "QUEUED",
          attempt: 0,
        });
        expect(countRunningJobs(databasePath)).toBe(0);
      } finally {
        runDirectory ??= findOptionalNewRunDirectory(beforeRuns);
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt(
    "recognizes ready evidence emitted before PowerShell observes it",
    async () => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory("ready-race");
      const databasePath = join(temporaryDirectory, "ready-race.sqlite");
      const contentRoot = join(temporaryDirectory, "content");
      const workerEntrypoint = join(
        temporaryDirectory,
        "ready-race-worker.mjs",
      );
      createQueuedJobs(databasePath, 1);
      writeFileSync(
        workerEntrypoint,
        realJobWorkerFixture({ crashImmediatelyAfterClaim: true }),
        "utf8",
      );
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const started = spawnScript(
          "start-v1-local.ps1",
          ["-DatabasePath", databasePath, "-ContentRoot", contentRoot],
          testEnvironment(workerEntrypoint),
        );
        const result = await started.completed;
        expect(result.status).not.toBe(0);
        expect(result.stdout).toContain("managed lifecycle: STARTING_WORKER");
        expect(result.stdout).not.toContain("managed lifecycle: READY");
        expect(`${result.stdout}\n${result.stderr}`).toContain(
          "requires crashed-Worker review",
        );

        expect(existsSync(statePath)).toBe(true);
        const crashedState = readState();
        runDirectory = resolve(crashedState.run_directory);
        expect(crashedState.lifecycle_status).toBe(
          "CRASHED_WORKER_REVIEW_REQUIRED",
        );
        expect(crashedState.worker_ready_observed).toBe(true);
        expect(readJsonEvents(crashedState.logs.worker_stdout)).toContainEqual(
          expect.objectContaining({
            event: "worker_platform_shell_ready",
            accepts_jobs: true,
            readiness_verified: expect.arrayContaining([
              "database",
              "migrations",
              "handlers",
            ]),
          }),
        );
        const workerRecord = crashedState.processes.find(
          (record) => record.role === "worker",
        );
        expect(isProcessAlive(workerRecord?.pid ?? -1)).toBe(false);
        for (const role of ["api", "web"]) {
          const record = crashedState.processes.find(
            (item) => item.role === role,
          );
          expect(record).toBeDefined();
          expect(isProcessAlive(record?.pid ?? -1)).toBe(true);
        }
        expect(readJob(databasePath, "managed-job-1")).toMatchObject({
          state: "RUNNING",
          attempt: 1,
        });
        expect(countRunningJobs(databasePath)).toBe(1);
        expect(
          readJsonEvents(crashedState.logs.worker_stdout),
        ).not.toContainEqual(
          expect.objectContaining({
            event: "worker_platform_shell_stopped",
            signal: "CONTROL_FILE",
          }),
        );

        const refused = runScript("stop-v1-local.ps1");
        expect(refused.status).not.toBe(0);
        expect(existsSync(statePath)).toBe(true);
        expect(countRunningJobs(databasePath)).toBe(1);

        const acknowledged = runScript("stop-v1-local.ps1", [
          "-AcknowledgeCrashedWorker",
        ]);
        expect(acknowledged.status, diagnostic(acknowledged)).toBe(0);
        expect(acknowledged.stdout).toContain("not a graceful Worker stop");
        expect(
          existsSync(join(runDirectory, "crashed-worker-state.json")),
        ).toBe(true);
        expect(existsSync(statePath)).toBe(false);
        expect(countRunningJobs(databasePath)).toBe(1);
        expect(existsSync(databasePath)).toBe(true);
        expect(existsSync(contentRoot)).toBe(true);
        expect(existsSync(crashedState.logs.worker_stdout)).toBe(true);
      } finally {
        runDirectory ??= findOptionalNewRunDirectory(beforeRuns);
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt.each(["api", "web"] as const)(
    "allows crashed-worker acknowledgement when %s is already stopped",
    async (stoppedRole) => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory(
        `partial-${stoppedRole}`,
      );
      const databasePath = join(temporaryDirectory, "partial.sqlite");
      const contentRoot = join(temporaryDirectory, "content");
      const crashTrigger = join(temporaryDirectory, "crash-trigger");
      const workerEntrypoint = join(
        temporaryDirectory,
        "partial-worker.mjs",
      );
      createQueuedJobs(databasePath, 1);
      writeFileSync(
        workerEntrypoint,
        realJobWorkerFixture({ crashFile: crashTrigger }),
        "utf8",
      );
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const started = spawnScript(
          "start-v1-local.ps1",
          ["-DatabasePath", databasePath, "-ContentRoot", contentRoot],
          testEnvironment(workerEntrypoint, crashTrigger),
        );
        const readyState = await waitForState(
          (state) =>
            state.lifecycle_status === "READY" &&
            readJob(databasePath, "managed-job-1").state === "RUNNING",
          45_000,
        );
        runDirectory = resolve(readyState.run_directory);
        touch(crashTrigger);
        const result = await started.completed;
        expect(result.status).not.toBe(0);

        const crashedState = readState();
        expect(crashedState.lifecycle_status).toBe(
          "CRASHED_WORKER_REVIEW_REQUIRED",
        );
        expect(crashedState.worker_ready_observed).toBe(true);
        const stoppedRecord = crashedState.processes.find(
          (record) => record.role === stoppedRole,
        );
        expect(stoppedRecord).toBeDefined();
        assertOwnedProcess(stoppedRecord as ManagedState["processes"][number]);
        process.kill(stoppedRecord?.pid ?? -1);
        await waitForCondition(
          () => !isProcessAlive(stoppedRecord?.pid ?? -1),
          10_000,
          `${stoppedRole} owned process to stop`,
        );

        const remainingRole = stoppedRole === "api" ? "web" : "api";
        const remainingRecord = crashedState.processes.find(
          (record) => record.role === remainingRole,
        );
        expect(isProcessAlive(remainingRecord?.pid ?? -1)).toBe(true);

        const acknowledged = runScript("stop-v1-local.ps1", [
          "-AcknowledgeCrashedWorker",
        ]);
        expect(acknowledged.status, diagnostic(acknowledged)).toBe(0);
        expect(acknowledged.stdout).toContain(
          `${stoppedRole}: already stopped`,
        );
        expect(isProcessAlive(remainingRecord?.pid ?? -1)).toBe(false);
        expect(
          existsSync(join(runDirectory, "crashed-worker-state.json")),
        ).toBe(true);
        expect(existsSync(statePath)).toBe(false);
        expect(readJob(databasePath, "managed-job-1")).toMatchObject({
          state: "RUNNING",
          attempt: 1,
        });
        expect(countRunningJobs(databasePath)).toBe(1);
        expect(existsSync(databasePath)).toBe(true);
        expect(existsSync(contentRoot)).toBe(true);
        expect(existsSync(crashedState.logs.worker_stdout)).toBe(true);
      } finally {
        runDirectory ??= findOptionalNewRunDirectory(beforeRuns);
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );

  windowsIt(
    "requires explicit acknowledgement after a ready Worker crashes without CONTROL_FILE evidence",
    async () => {
      await requireManagedEnvironment();
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = createTemporaryDirectory("worker-crash");
      const databasePath = join(temporaryDirectory, "crash.sqlite");
      const crashTrigger = join(temporaryDirectory, "crash-trigger");
      const workerEntrypoint = join(temporaryDirectory, "crashing-worker.mjs");
      createQueuedJobs(databasePath, 1);
      writeFileSync(
        workerEntrypoint,
        realJobWorkerFixture({ crashFile: crashTrigger }),
        "utf8",
      );
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        const started = spawnScript(
          "start-v1-local.ps1",
          [
            "-DatabasePath",
            databasePath,
            "-ContentRoot",
            join(temporaryDirectory, "content"),
          ],
          testEnvironment(workerEntrypoint, crashTrigger),
        );
        const readyState = await waitForState(
          (state) =>
            state.lifecycle_status === "READY" &&
            readJob(databasePath, "managed-job-1").state === "RUNNING",
          45_000,
        );
        runDirectory = readyState.run_directory;
        touch(crashTrigger);
        const result = await started.completed;
        expect(result.status).not.toBe(0);
        expect(existsSync(statePath)).toBe(true);

        const crashedState = readState();
        expect(crashedState.lifecycle_status).toBe(
          "CRASHED_WORKER_REVIEW_REQUIRED",
        );
        expect(crashedState.worker_ready_observed).toBe(true);
        const workerRecord = crashedState.processes.find(
          (record) => record.role === "worker",
        );
        expect(isProcessAlive(workerRecord?.pid ?? -1)).toBe(false);
        for (const role of ["api", "web"]) {
          const record = crashedState.processes.find(
            (item) => item.role === role,
          );
          expect(isProcessAlive(record?.pid ?? -1)).toBe(true);
        }
        expect(countRunningJobs(databasePath)).toBe(1);
        expect(
          readJsonEvents(crashedState.logs.worker_stdout),
        ).not.toContainEqual(
          expect.objectContaining({
            event: "worker_platform_shell_stopped",
            signal: "CONTROL_FILE",
          }),
        );

        const checked = runScript("check-v1-local.ps1");
        expect(checked.status).not.toBe(0);
        expect(checked.stdout).toContain(
          "V1 local status: crashed worker review required",
        );
        expect(`${checked.stdout}\n${checked.stderr}`).toContain(
          "may be orphaned",
        );

        const refused = runScript("stop-v1-local.ps1");
        expect(refused.status).not.toBe(0);
        expect(existsSync(statePath)).toBe(true);
        expect(countRunningJobs(databasePath)).toBe(1);

        const acknowledged = runScript("stop-v1-local.ps1", [
          "-AcknowledgeCrashedWorker",
        ]);
        expect(acknowledged.status, diagnostic(acknowledged)).toBe(0);
        expect(acknowledged.stdout).toContain("not a graceful Worker stop");
        const archivePath = join(runDirectory, "crashed-worker-state.json");
        expect(existsSync(archivePath)).toBe(true);
        expect(
          JSON.parse(readFileSync(archivePath, "utf8").replace(/^\uFEFF/, "")),
        ).toMatchObject({
          lifecycle_status: "CRASHED_WORKER_REVIEW_REQUIRED",
          worker_ready_observed: true,
        });
        expect(existsSync(statePath)).toBe(false);
        expect(countRunningJobs(databasePath)).toBe(1);
        for (const role of ["api", "web"]) {
          const record = crashedState.processes.find(
            (item) => item.role === role,
          );
          expect(isProcessAlive(record?.pid ?? -1)).toBe(false);
        }
      } finally {
        runDirectory ??= findOptionalNewRunDirectory(beforeRuns);
        cleanupFailure = cleanupManagedState(runDirectory);
        if (!cleanupFailure) {
          rmSync(temporaryDirectory, { recursive: true, force: true });
          removeOwnedRunDirectory(runDirectory);
        }
      }
      if (cleanupFailure) throw new Error(cleanupFailure);
    },
    120_000,
  );
});

type ManagedState = {
  run_directory: string;
  worker_stop_file: string;
  worker_entrypoint: string;
  worker_ready_observed: boolean;
  database_path: string;
  content_root: string;
  lifecycle_status: string;
  logs: {
    worker_stdout: string;
    worker_stderr: string;
  };
  processes: Array<{ role: string; pid: number; start_time_utc: string }>;
};

type ScriptResult = { status: number | null; stdout: string; stderr: string };

function readState(): ManagedState {
  return JSON.parse(
    readFileSync(statePath, "utf8").replace(/^\uFEFF/, ""),
  ) as ManagedState;
}

function runScript(
  script: string,
  args: string[] = [],
  extraEnvironment: NodeJS.ProcessEnv = {},
): ScriptResult {
  return spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve("scripts", script),
      ...args,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 90_000,
      env: { ...process.env, ...extraEnvironment },
    },
  );
}

function spawnScript(
  script: string,
  args: string[],
  extraEnvironment: NodeJS.ProcessEnv,
): { completed: Promise<ScriptResult> } {
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve("scripts", script),
      ...args,
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnvironment },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const completed = new Promise<ScriptResult>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("close", (status) => resolvePromise({ status, stdout, stderr }));
  });
  return { completed };
}

function testEnvironment(
  workerEntrypoint: string,
  rollbackTrigger?: string,
): NodeJS.ProcessEnv {
  return {
    V1_LOCAL_TEST_MODE: "1",
    V1_LOCAL_WORKER_ENTRYPOINT: resolve(workerEntrypoint),
    ...(rollbackTrigger
      ? { V1_LOCAL_TEST_ROLLBACK_TRIGGER_FILE: resolve(rollbackTrigger) }
      : {}),
  };
}

function readJsonEvents(path: string): unknown[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function assertManagedStopOrder(output: string): void {
  const workerStoppedIndex = output.indexOf("worker: stopped gracefully");
  const apiStoppedIndex = output.indexOf("api: stopped");
  const webStoppedIndex = output.indexOf("web: stopped");
  expect(workerStoppedIndex).toBeGreaterThanOrEqual(0);
  expect(apiStoppedIndex).toBeGreaterThan(workerStoppedIndex);
  expect(webStoppedIndex).toBeGreaterThan(apiStoppedIndex);
}

function assertOwnedProcess(record: ManagedState["processes"][number]): void {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$process = Get-Process -Id ${record.pid} -ErrorAction Stop; $process.StartTime.ToUniversalTime().ToString('o')`,
    ],
    { encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(
    Math.abs(
      Date.parse(result.stdout.trim()) - Date.parse(record.start_time_utc),
    ),
  ).toBeLessThan(1_000);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function requireManagedEnvironment(): Promise<void> {
  expect(
    existsSync(statePath),
    "A managed run is already active; the release smoke will not disturb it.",
  ).toBe(false);
  await expectManagedPortsAvailable();
}

async function expectManagedPortsAvailable(): Promise<void> {
  await expectPortAvailable(4310);
  await expectPortAvailable(4173);
}

async function expectPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", (error) => reject(error));
    server.listen(port, "127.0.0.1", () => {
      server.close((error) => (error ? reject(error) : resolvePromise()));
    });
  });
}

function createTemporaryDirectory(name: string): string {
  return mkdtempSync(join(tmpdir(), `research-reading-managed-${name}-`));
}

function preReadyFailureWorkerFixture(): string {
  return `console.error(JSON.stringify({ event: "worker_start_failed", error: { name: "ControlledPreReadyFailure" } }));
process.exit(1);
`;
}

function realJobWorkerFixture(options: {
  releaseFile?: string;
  crashFile?: string;
  crashImmediatelyAfterClaim?: boolean;
}): string {
  const storageUrl = pathToFileURL(
    resolve("packages/storage/dist/index.js"),
  ).href;
  const jobRuntimeUrl = pathToFileURL(
    resolve("apps/worker/dist/runtime/job-runtime.js"),
  ).href;
  const workerServiceUrl = pathToFileURL(
    resolve("apps/worker/dist/worker-service.js"),
  ).href;
  const workerLoopUrl = pathToFileURL(
    resolve("apps/worker/dist/worker-loop.js"),
  ).href;
  const migrationsDirectory = resolve("apps/api/migrations");
  return `import { existsSync, writeSync } from "node:fs";
import { openDatabase, StorageRepository } from ${JSON.stringify(storageUrl)};
import { JobRuntime } from ${JSON.stringify(jobRuntimeUrl)};
import { runWorkerService } from ${JSON.stringify(workerServiceUrl)};
import { watchWorkerStopFile } from ${JSON.stringify(workerLoopUrl)};

const database = openDatabase(process.env.SQLITE_DATABASE_PATH, { migrationsDirectory: ${JSON.stringify(migrationsDirectory)} });
const storage = new StorageRepository(database);
const releaseFile = ${JSON.stringify(options.releaseFile ?? null)};
const crashFile = ${JSON.stringify(options.crashFile ?? null)};
const crashImmediatelyAfterClaim = ${JSON.stringify(options.crashImmediatelyAfterClaim ?? false)};
const wait = (delay) => new Promise((resolvePromise) => setTimeout(resolvePromise, delay));
const handler = async () => {
  if (crashImmediatelyAfterClaim) process.exit(17);
  for (;;) {
    if (crashFile && existsSync(crashFile)) process.exit(17);
    if (releaseFile && existsSync(releaseFile)) return { released: true };
    await wait(25);
  }
};
const jobRuntime = new JobRuntime(storage, "managed-release-worker", { QUESTION_PLAN: handler });
writeSync(1, JSON.stringify({
  event: "worker_platform_shell_ready",
  service: "worker-platform-shell",
  accepts_jobs: true,
  readiness_verified: ["database", "migrations", "handlers"],
  registered_handlers: ["QUESTION_PLAN"]
}) + "\\n");
const stopController = new AbortController();
let stopSignal;
const requestStop = (signal) => {
  if (stopSignal) return;
  stopSignal = signal;
  stopController.abort();
};
const stopWatching = watchWorkerStopFile(process.env.WORKER_STOP_FILE, () => requestStop("CONTROL_FILE"));
try {
  await runWorkerService(
    { database, jobRuntime },
    {
      signal: stopController.signal,
      onStopped: () => console.log(JSON.stringify({ event: "worker_platform_shell_stopped", signal: stopSignal ?? "STOPPED" }))
    }
  );
} finally {
  stopWatching();
}
`;
}

function createQueuedJobs(databasePath: string, count: number): void {
  const database = openDatabase(databasePath, {
    migrationsDirectory: resolve("apps/api/migrations"),
  });
  try {
    const storage = new StorageRepository(database);
    for (let index = 1; index <= count; index += 1) {
      storage.createJob({
        jobId: `managed-job-${index}`,
        kind: "QUESTION_PLAN",
        payload: { index },
        idempotencyKey: `managed-job-key-${index}`,
      });
    }
  } finally {
    database.close();
  }
}

function readJob(
  databasePath: string,
  jobId: string,
): { state: string; attempt: number } {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = database
      .prepare("SELECT state, attempt FROM jobs WHERE job_id = ?")
      .get(jobId) as { state: string; attempt: number } | undefined;
    if (!row) throw new Error(`Missing test Job ${jobId}`);
    return { state: String(row.state), attempt: Number(row.attempt) };
  } finally {
    database.close();
  }
}

function countRunningJobs(databasePath: string): number {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const row = database
      .prepare("SELECT COUNT(*) AS count FROM jobs WHERE state = 'RUNNING'")
      .get() as { count: number };
    return Number(row.count);
  } finally {
    database.close();
  }
}

async function waitForState(
  predicate: (state: ManagedState) => boolean,
  timeoutMs: number,
): Promise<ManagedState> {
  let matched: ManagedState | undefined;
  await waitForCondition(
    () => {
      if (!existsSync(statePath)) return false;
      try {
        const state = readState();
        if (!predicate(state)) return false;
        matched = state;
        return true;
      } catch {
        return false;
      }
    },
    timeoutMs,
    "managed state condition",
  );
  if (!matched)
    throw new Error("Managed state condition matched without state");
  return matched;
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  description: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function waitForEvent(
  path: string,
  eventName: string,
  timeoutMs: number,
): Promise<void> {
  await waitForCondition(
    () =>
      readJsonEvents(path).some(
        (event) =>
          typeof event === "object" &&
          event !== null &&
          "event" in event &&
          event.event === eventName,
      ),
    timeoutMs,
    `${eventName} in ${path}`,
  );
}

function touch(path: string): void {
  writeFileSync(path, "", "utf8");
}

function listRunDirectories(): Set<string> {
  if (!existsSync(runsRoot)) return new Set();
  return new Set(
    readdirSync(runsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(runsRoot, entry.name)),
  );
}

function findNewRunDirectory(before: Set<string>): string {
  const newRuns = [...listRunDirectories()].filter((path) => !before.has(path));
  expect(newRuns).toHaveLength(1);
  return newRuns[0] as string;
}

function findOptionalNewRunDirectory(before: Set<string>): string | undefined {
  const newRuns = [...listRunDirectories()].filter((path) => !before.has(path));
  return newRuns.length === 1 ? newRuns[0] : undefined;
}

function removeOwnedRunDirectory(runDirectory: string | undefined): void {
  if (runDirectory?.startsWith(resolve(runsRoot) + sep))
    rmSync(runDirectory, { recursive: true, force: true });
}

function cleanupManagedState(
  runDirectory: string | undefined,
): string | undefined {
  if (!existsSync(statePath)) return undefined;
  let lifecycle = "UNKNOWN";
  try {
    lifecycle = readState().lifecycle_status;
  } catch {}
  const args =
    lifecycle === "CRASHED_WORKER_REVIEW_REQUIRED"
      ? ["-AcknowledgeCrashedWorker"]
      : ["-WorkerTimeoutSeconds", "10"];
  const cleanup = runScript("stop-v1-local.ps1", args);
  if (cleanup.status === 0) return undefined;
  return `Managed cleanup failed; temporary data and diagnostic logs were preserved at ${runDirectory ?? "the run directory recorded in processes.json"}. ${diagnostic(cleanup)}`;
}

function diagnostic(result: ScriptResult): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
