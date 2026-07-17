import { createWorkerRuntime } from "./runtime.js";
import { runWorkerService } from "./worker-service.js";

const runtime = createWorkerRuntime();
const smoke =
  process.env.WORKER_SMOKE === "1" || process.argv.includes("--smoke");
console.log(
  JSON.stringify({
    event: "worker_platform_shell_ready",
    service: "worker-platform-shell",
    smoke,
    accepts_jobs: true,
    registered_handlers: Object.keys(runtime.handlers).sort(),
  }),
);

if (smoke) {
  await runWorkerService(runtime, { smoke: true });
} else {
  const stopController = new AbortController();
  let stopSignal: string | undefined;
  const requestStop = (signal: string) => {
    if (stopSignal) return;
    stopSignal = signal;
    stopController.abort();
  };
  process.once("SIGINT", () => requestStop("SIGINT"));
  process.once("SIGTERM", () => requestStop("SIGTERM"));

  try {
    await runWorkerService(runtime, {
      signal: stopController.signal,
      onStopped: () => {
        console.log(
          JSON.stringify({
            event: "worker_platform_shell_stopped",
            signal: stopSignal ?? "STOPPED",
          }),
        );
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "worker_platform_shell_error",
        error: safeErrorSummary(error),
      }),
    );
    process.exitCode = 1;
  }
}

function safeErrorSummary(error: unknown): { name: string } {
  return { name: error instanceof Error ? error.name : "WorkerError" };
}
