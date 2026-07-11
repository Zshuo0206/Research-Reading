import Fastify from "fastify";

export function createApiServer() {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({
    status: "ok",
    service: "api-platform-shell",
    wave: 1,
    schema_version: "api.v1",
  }));
  return app;
}

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 4310);
if (host !== "127.0.0.1") {
  console.error(JSON.stringify({ error: "API_HOST must be 127.0.0.1" }));
  process.exit(1);
}

const app = createApiServer();
try {
  await app.listen({ host, port });
  console.log(
    JSON.stringify({
      event: "server_started",
      service: "api-platform-shell",
      host,
      port,
    }),
  );
  if (process.argv.includes("--smoke")) await app.close();
} catch (error) {
  console.error(
    JSON.stringify({
      error: "API_START_FAILED",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
}
