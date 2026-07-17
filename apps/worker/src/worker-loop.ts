export interface WorkerLoopRuntime {
  jobRuntime: {
    runOnce(): Promise<boolean>;
  };
}

export interface WorkerLoopOptions {
  idleDelayMs?: number;
  signal?: AbortSignal;
  sleep?: (delayMs: number) => Promise<void>;
}

export const DEFAULT_WORKER_IDLE_DELAY_MS = 250;

export async function runWorkerLoop(
  runtime: WorkerLoopRuntime,
  options: WorkerLoopOptions = {},
): Promise<void> {
  const idleDelayMs = options.idleDelayMs ?? DEFAULT_WORKER_IDLE_DELAY_MS;
  if (!Number.isFinite(idleDelayMs) || idleDelayMs < 0)
    throw new Error("Worker idle delay must be a non-negative finite number");

  const signal = options.signal;
  const sleep = options.sleep ?? ((delayMs: number) => wait(delayMs, signal));

  while (!signal?.aborted) {
    const processed = await runtime.jobRuntime.runOnce();
    if (!processed && !signal?.aborted) await sleep(idleDelayMs);
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
