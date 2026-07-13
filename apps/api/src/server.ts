import Fastify from "fastify";
import { isApiHostAllowed } from "./host-policy.js";
import { createApiRuntime } from "./runtime.js";

export function createApiServer() {
  const app = Fastify({ logger: false });
  const runtime = createApiRuntime();

  app.decorate("workflowApiHandlers", runtime.workflowHandlers);
  app.decorate("byokConnectionTestApi", runtime.byokConnectionTestApi);
  app.addHook("onClose", async () => {
    runtime.database.close();
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "api-platform-shell",
    wave: 1,
    schema_version: "api.v1",
  }));

  app.post("/api/v1/byok/session-key", async (request, reply) => {
    const body = request.body as { api_key?: unknown } | undefined;
    if (!body || typeof body.api_key !== "string") {
      return reply
        .code(400)
        .send({ error: "A non-empty api_key is required." });
    }
    try {
      return runtime.byokConnectionTestApi.registerSessionKey(body.api_key);
    } catch {
      return reply.code(400).send({ error: "The API key is invalid." });
    }
  });

  app.delete(
    "/api/v1/byok/session-key/:handle",
    async (request) => {
      const params = request.params as { handle?: string };
      return runtime.byokConnectionTestApi.clearSessionKey(params.handle ?? "");
    },
  );

  app.post("/api/v1/byok/connection-test", async (request, reply) => {
    try {
      const result = await runtime.byokConnectionTestApi.testConnection(
        request.body as never,
      );
      return reply.code(result.status_code).send(result.body);
    } catch {
      return reply
        .code(400)
        .send({ error: "The connection-test request is invalid." });
    }
  });

  return app;
}

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 4310);
const containerMode = process.env.CONTAINER_MODE === "1";
if (!isApiHostAllowed(host, containerMode)) {
  console.error(
    JSON.stringify({
      error:
        "API_HOST must be 127.0.0.1 unless CONTAINER_MODE=1 explicitly allows 0.0.0.0 inside a container",
    }),
  );
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
