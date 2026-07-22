import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const windowsIt = process.platform === "win32" ? it : it.skip;
const repoRoot = resolve(".");
const statePath = join(repoRoot, "tmp", "v1-local", "processes.json");
const runsRoot = join(repoRoot, "tmp", "v1-local", "runs");

describe("V1 managed local process lifecycle", () => {
  windowsIt(
    "starts, checks and gracefully stops the managed API, Worker and Web processes",
    async () => {
      expect(
        existsSync(statePath),
        "A managed run is already active; the smoke will not disturb it.",
      ).toBe(false);
      await expectPortAvailable(4310);
      await expectPortAvailable(4173);

      const temporaryDirectory = mkdtempSync(
        join(tmpdir(), "research-reading-managed-smoke-"),
      );
      const databasePath = join(temporaryDirectory, "managed.sqlite");
      const contentRoot = join(temporaryDirectory, "content");
      let runDirectory: string | undefined;
      let processRecords: Array<{ pid: number }> = [];
      try {
        const started = runScript("start-v1-local.ps1", [
          "-DatabasePath",
          databasePath,
          "-ContentRoot",
          contentRoot,
        ]);
        expect(started.status, started.stderr).toBe(0);
        expect(started.stdout).toContain("Worker ready verified");
        expect(existsSync(statePath)).toBe(true);

        const state = JSON.parse(
          readFileSync(statePath, "utf8").replace(/^\uFEFF/, ""),
        ) as {
          run_directory: string;
          worker_stop_file: string;
          database_path: string;
          content_root: string;
          logs: { worker_stdout: string };
          processes: Array<{ pid: number }>;
        };
        runDirectory = resolve(state.run_directory);
        processRecords = state.processes;
        expect(runDirectory.startsWith(resolve(runsRoot) + sep)).toBe(true);
        expect(
          resolve(state.worker_stop_file).startsWith(runDirectory + sep),
        ).toBe(true);
        const workerEvents = readJsonEvents(state.logs.worker_stdout);
        expect(workerEvents).toContainEqual(
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
        const workerStoppedIndex = stopped.stdout.indexOf(
          "worker: stopped gracefully",
        );
        const apiStoppedIndex = stopped.stdout.indexOf("api: stopped");
        const webStoppedIndex = stopped.stdout.indexOf("web: stopped");
        expect(workerStoppedIndex).toBeGreaterThanOrEqual(0);
        expect(apiStoppedIndex).toBeGreaterThan(workerStoppedIndex);
        expect(webStoppedIndex).toBeGreaterThan(apiStoppedIndex);
        expect(existsSync(statePath)).toBe(false);
        expect(existsSync(databasePath)).toBe(true);
        expect(existsSync(contentRoot)).toBe(true);
        expect(readJsonEvents(state.logs.worker_stdout)).toContainEqual(
          expect.objectContaining({
            event: "worker_platform_shell_stopped",
            signal: "CONTROL_FILE",
          }),
        );
        for (const record of processRecords)
          expect(isProcessAlive(record.pid)).toBe(false);
      } finally {
        if (existsSync(statePath)) runScript("stop-v1-local.ps1");
        rmSync(temporaryDirectory, { recursive: true, force: true });
        if (runDirectory?.startsWith(resolve(runsRoot) + sep))
          rmSync(runDirectory, { recursive: true, force: true });
      }
    },
    120_000,
  );
});

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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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
