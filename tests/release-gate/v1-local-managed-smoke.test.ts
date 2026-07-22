import { spawnSync } from "node:child_process";
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
import { describe, expect, it } from "vitest";

const windowsIt = process.platform === "win32" ? it : it.skip;
const repoRoot = resolve(".");
const statePath = join(repoRoot, "tmp", "v1-local", "processes.json");
const runsRoot = join(repoRoot, "tmp", "v1-local", "runs");
const workerBuildPath = join(repoRoot, "apps", "worker", "dist", "worker.js");

describe("V1 managed local process release gate", () => {
  windowsIt(
    "starts API and Web before Worker, checks health and stops gracefully",
    async () => {
      await requireManagedEnvironment();
      const temporaryDirectory = mkdtempSync(
        join(tmpdir(), "research-reading-managed-smoke-"),
      );
      const databasePath = join(temporaryDirectory, "managed.sqlite");
      const contentRoot = join(temporaryDirectory, "content");
      let runDirectory: string | undefined;
      let processRecords: Array<{ pid: number }> = [];
      let cleanupFailure: string | undefined;
      try {
        const started = runScript("start-v1-local.ps1", [
          "-DatabasePath",
          databasePath,
          "-ContentRoot",
          contentRoot,
        ]);
        expect(started.status, started.stderr).toBe(0);
        expect(started.stdout.indexOf("api: healthy")).toBeGreaterThanOrEqual(
          0,
        );
        expect(started.stdout.indexOf("web: healthy")).toBeGreaterThan(
          started.stdout.indexOf("api: healthy"),
        );
        expect(started.stdout).toContain("Worker ready verified");
        expect(existsSync(statePath)).toBe(true);

        const state = readState();
        runDirectory = resolve(state.run_directory);
        processRecords = state.processes;
        expect(state.lifecycle_status).toBe("READY");
        expect(runDirectory.startsWith(resolve(runsRoot) + sep)).toBe(true);
        expect(
          resolve(state.worker_stop_file).startsWith(runDirectory + sep),
        ).toBe(true);
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
        expect(checked.status, checked.stderr).toBe(0);
        expect(checked.stdout).toContain("worker ready: verified");
        expect(checked.stdout).toContain("V1 local status: healthy");

        const stopped = runScript("stop-v1-local.ps1");
        expect(stopped.status, stopped.stderr).toBe(0);
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
        if (existsSync(statePath)) {
          const cleanup = runScript("stop-v1-local.ps1");
          if (cleanup.status !== 0)
            cleanupFailure = `Managed cleanup failed; diagnostic logs preserved at ${runDirectory ?? "the run directory recorded in processes.json"}: ${cleanup.stderr}`;
        }
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
    "uses the control file instead of killing Worker after startup failure",
    async () => {
      await requireManagedEnvironment();
      const originalWorker = readFileSync(workerBuildPath);
      const beforeRuns = listRunDirectories();
      const temporaryDirectory = mkdtempSync(
        join(tmpdir(), "research-reading-start-rollback-"),
      );
      const databasePath = join(temporaryDirectory, "rollback.sqlite");
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        writeFileSync(workerBuildPath, workerFailureFixture(200));
        const result = runScript("start-v1-local.ps1", [
          "-DatabasePath",
          databasePath,
          "-ContentRoot",
          join(temporaryDirectory, "content"),
        ]);
        expect(result.status).not.toBe(0);
        expect(result.stdout).toContain(
          "worker: startup rollback control-file stop requested",
        );
        expect(result.stdout).toContain(
          "worker: stopped gracefully during startup rollback",
        );
        assertManagedStopOrder(result.stdout);
        expect(existsSync(statePath)).toBe(false);

        runDirectory = findNewRunDirectory(beforeRuns);
        const workerEvents = readJsonEvents(
          join(runDirectory, "worker.stdout.log"),
        );
        expect(workerEvents).toContainEqual({
          event: "worker_platform_shell_stopped",
          signal: "CONTROL_FILE",
        });
        expect(countRunningJobs(databasePath)).toBe(0);
        await expectPortAvailable(4310);
        await expectPortAvailable(4173);
      } finally {
        writeFileSync(workerBuildPath, originalWorker);
        if (existsSync(statePath)) {
          const cleanup = runScript("stop-v1-local.ps1", [
            "-WorkerTimeoutSeconds",
            "10",
          ]);
          if (cleanup.status !== 0)
            cleanupFailure = `Startup rollback cleanup failed; logs preserved at ${runDirectory ?? "the recorded run directory"}: ${cleanup.stderr}`;
        }
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
    "preserves state and API/Web when startup rollback Worker stop times out",
    async () => {
      await requireManagedEnvironment();
      const originalWorker = readFileSync(workerBuildPath);
      const temporaryDirectory = mkdtempSync(
        join(tmpdir(), "research-reading-start-timeout-"),
      );
      const databasePath = join(temporaryDirectory, "timeout.sqlite");
      let runDirectory: string | undefined;
      let cleanupFailure: string | undefined;
      try {
        writeFileSync(workerBuildPath, workerFailureFixture(2500));
        const result = runScript("start-v1-local.ps1", [
          "-DatabasePath",
          databasePath,
          "-ContentRoot",
          join(temporaryDirectory, "content"),
          "-WorkerStopTimeoutSeconds",
          "1",
        ]);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(
          "may still be completing its current Job",
        );
        expect(existsSync(statePath)).toBe(true);

        const state = readState();
        runDirectory = state.run_directory;
        expect(state.lifecycle_status).toBe("START_FAILED_STOP_PENDING");
        expect(existsSync(state.worker_stop_file)).toBe(true);
        for (const role of ["api", "web"]) {
          const record = state.processes.find((item) => item.role === role);
          expect(record).toBeDefined();
          expect(isProcessAlive(record?.pid ?? -1)).toBe(true);
        }

        await waitForEvent(
          state.logs.worker_stdout,
          "worker_platform_shell_stopped",
          10_000,
        );
        const stopped = runScript("stop-v1-local.ps1");
        expect(stopped.status, stopped.stderr).toBe(0);
        assertManagedStopOrder(stopped.stdout);
        expect(existsSync(statePath)).toBe(false);
        expect(countRunningJobs(databasePath)).toBe(0);
      } finally {
        writeFileSync(workerBuildPath, originalWorker);
        if (existsSync(statePath)) {
          const cleanup = runScript("stop-v1-local.ps1", [
            "-WorkerTimeoutSeconds",
            "10",
          ]);
          if (cleanup.status !== 0)
            cleanupFailure = `Timed-out startup cleanup failed; diagnostic logs preserved at ${runDirectory ?? "the recorded run directory"}: ${cleanup.stderr}`;
        }
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
  database_path: string;
  content_root: string;
  lifecycle_status: string;
  logs: { worker_stdout: string };
  processes: Array<{ role: string; pid: number }>;
};

function readState(): ManagedState {
  return JSON.parse(
    readFileSync(statePath, "utf8").replace(/^\uFEFF/, ""),
  ) as ManagedState;
}

function runScript(script: string, args: string[] = []) {
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
    { cwd: repoRoot, encoding: "utf8", timeout: 90_000 },
  );
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

function workerFailureFixture(stopDelayMs: number): string {
  return `import { existsSync } from "node:fs";
const stopFile = process.env.WORKER_STOP_FILE;
console.error(JSON.stringify({ event: "worker_platform_shell_error", error: { name: "ControlledStartupFailure" } }));
let stopSeenAt;
const timer = setInterval(() => {
  if (!stopSeenAt && stopFile && existsSync(stopFile)) stopSeenAt = Date.now();
  if (stopSeenAt && Date.now() - stopSeenAt >= ${stopDelayMs}) {
    clearInterval(timer);
    console.log(JSON.stringify({ event: "worker_platform_shell_stopped", signal: "CONTROL_FILE" }));
    process.exit(0);
  }
}, 25);
`;
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

function removeOwnedRunDirectory(runDirectory: string | undefined): void {
  if (runDirectory?.startsWith(resolve(runsRoot) + sep))
    rmSync(runDirectory, { recursive: true, force: true });
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

async function waitForEvent(
  path: string,
  eventName: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (
      readJsonEvents(path).some(
        (event) =>
          typeof event === "object" &&
          event !== null &&
          "event" in event &&
          event.event === eventName,
      )
    )
      return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`Timed out waiting for ${eventName} in ${path}`);
}
