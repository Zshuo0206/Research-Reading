import { createWorkerRuntime } from "./runtime.js";
import { runWorkerService } from "./worker-service.js";

async function startWorker(): Promise<void> {
  const smoke =
    process.env.WORKER_SMOKE === "1" || process.argv.includes("--smoke");
  let runtime: ReturnType<typeof createWorkerRuntime>;
  try {
    runtime = createWorkerRuntime();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "worker_start_failed",
        error: safeErrorSummary(error),
      }),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify({
      event: "worker_platform_shell_ready",
      service: "worker-platform-shell",
      smoke,
      accepts_jobs: true,
      readiness_verified: ["database", "migrations", "handlers"],
      registered_handlers: Object.keys(runtime.handlers).sort(),
      concurrency_support: "single_worker_recommended",
      multi_worker_note:
        "Atomic claims are guarded; multi-worker stress certification is outside V1.0.",
    }),
  );

  if (smoke) {
    try {
      await runWorkerService(runtime, { smoke: true });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "worker_platform_shell_error",
          error: safeErrorSummary(error),
        }),
      );
      process.exitCode = 1;
    }
    return;
  }

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
      onLoopError: ({ error, consecutiveFailures, retryDelayMs }) => {
        console.error(
          JSON.stringify({
            event: "worker_loop_retry",
            consecutive_failures: consecutiveFailures,
            retry_delay_ms: retryDelayMs,
            error: safeErrorSummary(error),
          }),
        );
      },
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

function safeErrorSummary(error: unknown): { name: string; code?: string } {
  const name = error instanceof Error ? error.name : "WorkerError";
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code.slice(0, 100)
      : undefined;
  return code ? { name, code } : { name };
}

await startWorker();
