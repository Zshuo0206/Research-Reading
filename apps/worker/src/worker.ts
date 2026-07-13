import { createWorkerRuntime } from "./runtime.js";

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
  runtime.database.close();
  process.exit(0);
}

if (!smoke) {
  const shutdown = (signal: string) => {
    runtime.database.close();
    console.log(
      JSON.stringify({ event: "worker_platform_shell_stopped", signal }),
    );
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
