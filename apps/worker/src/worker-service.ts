import {
  runWorkerLoop,
  type WorkerLoopOptions,
  type WorkerLoopRuntime,
} from "./worker-loop.js";

export interface WorkerServiceRuntime extends WorkerLoopRuntime {
  database: {
    close(): void;
  };
}

export interface WorkerServiceOptions extends WorkerLoopOptions {
  smoke?: boolean;
  onStopped?: () => void;
}

export async function runWorkerService(
  runtime: WorkerServiceRuntime,
  options: WorkerServiceOptions = {},
): Promise<void> {
  let closed = false;
  const closeDatabase = () => {
    if (closed) return;
    closed = true;
    runtime.database.close();
  };

  try {
    if (!options.smoke) await runWorkerLoop(runtime, options);
  } finally {
    closeDatabase();
    if (!options.smoke) options.onStopped?.();
  }
}
