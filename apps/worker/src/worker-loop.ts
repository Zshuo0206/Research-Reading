import { existsSync } from "node:fs";

export interface WorkerLoopRuntime {
  jobRuntime: {
    runOnce(): Promise<boolean>;
  };
}

export interface WorkerLoopOptions {
  idleDelayMs?: number;
  errorDelayMs?: number;
  maxErrorDelayMs?: number;
  signal?: AbortSignal;
  sleep?: (delayMs: number) => Promise<void>;
  onLoopError?: (event: {
    error: unknown;
    consecutiveFailures: number;
    retryDelayMs: number;
  }) => void;
}

export const DEFAULT_WORKER_IDLE_DELAY_MS = 250;
export const DEFAULT_WORKER_ERROR_DELAY_MS = 250;
export const DEFAULT_WORKER_MAX_ERROR_DELAY_MS = 5000;

export async function runWorkerLoop(
  runtime: WorkerLoopRuntime,
  options: WorkerLoopOptions = {},
): Promise<void> {
  const idleDelayMs = options.idleDelayMs ?? DEFAULT_WORKER_IDLE_DELAY_MS;
  const errorDelayMs = options.errorDelayMs ?? DEFAULT_WORKER_ERROR_DELAY_MS;
  const maxErrorDelayMs =
    options.maxErrorDelayMs ?? DEFAULT_WORKER_MAX_ERROR_DELAY_MS;
  if (!Number.isFinite(idleDelayMs) || idleDelayMs < 0)
    throw new Error("Worker idle delay must be a non-negative finite number");
  if (!Number.isFinite(errorDelayMs) || errorDelayMs < 0)
    throw new Error("Worker error delay must be a non-negative finite number");
  if (!Number.isFinite(maxErrorDelayMs) || maxErrorDelayMs < errorDelayMs)
    throw new Error(
      "Worker maximum error delay must be finite and no smaller than the error delay",
    );

  const signal = options.signal;
  const sleep = options.sleep ?? ((delayMs: number) => wait(delayMs, signal));
  let consecutiveFailures = 0;

  while (!signal?.aborted) {
    try {
      const processed = await runtime.jobRuntime.runOnce();
      consecutiveFailures = 0;
      if (!processed && !signal?.aborted) await sleep(idleDelayMs);
    } catch (error) {
      if (signal?.aborted) break;
      consecutiveFailures += 1;
      const retryDelayMs = Math.min(
        maxErrorDelayMs,
        errorDelayMs * 2 ** Math.min(consecutiveFailures - 1, 20),
      );
      options.onLoopError?.({
        error,
        consecutiveFailures,
        retryDelayMs,
      });
      if (!signal?.aborted) await sleep(retryDelayMs);
    }
  }
}

function wait(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

export interface WorkerStopFileWatcherOptions {
  intervalMs?: number;
  fileExists?: (path: string) => boolean;
}

export function watchWorkerStopFile(
  stopFilePath: string | undefined,
  requestStop: () => void,
  options: WorkerStopFileWatcherOptions = {},
): () => void {
  if (!stopFilePath?.trim()) return () => undefined;
  const intervalMs = options.intervalMs ?? 250;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0)
    throw new Error(
      "Worker stop-file interval must be a positive finite number",
    );

  const fileExists = options.fileExists ?? existsSync;
  let active = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  const dispose = () => {
    if (!active) return;
    active = false;
    if (timer) clearInterval(timer);
    timer = undefined;
  };
  const check = () => {
    if (!active) return;
    let requested = false;
    try {
      requested = fileExists(stopFilePath);
    } catch {
      return;
    }
    if (!requested) return;
    dispose();
    requestStop();
  };

  timer = setInterval(check, intervalMs);
  timer.unref?.();
  check();
  return dispose;
}
