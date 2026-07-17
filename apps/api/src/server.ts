import { fileURLToPath } from "node:url";
import Fastify, { type FastifyReply } from "fastify";
import { isApiHostAllowed } from "./host-policy.js";
import { createApiRuntime } from "./runtime.js";

export function createApiServer(
  options: { databasePath?: string; contentRoot?: string } = {},
) {
  const app = Fastify({ logger: false });
  const runtime = createApiRuntime(options.databasePath, options.contentRoot);
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (
      origin === "http://127.0.0.1:4173" ||
      origin === "http://localhost:4173"
    ) {
      reply.header("access-control-allow-origin", origin);
      reply.header(
        "access-control-allow-headers",
        "accept, content-type, idempotency-key, x-filename, x-request-id",
      );
      reply.header(
        "access-control-allow-methods",
        "GET, POST, PATCH, DELETE, OPTIONS",
      );
    }
    if (request.method === "OPTIONS") return reply.code(204).send();
  });
  const sendHandled = async (
    reply: FastifyReply,
    id: string,
    operation: (
      service: typeof runtime.workflowService,
    ) => unknown | Promise<unknown>,
  ) => {
    const result = await runtime.workflowHandlers.handle(id, operation);
    return reply.code(result.statusCode).send(result.body);
  };

  app.decorate("workflowApiHandlers", runtime.workflowHandlers);
  app.decorate("byokConnectionTestApi", runtime.byokConnectionTestApi);
  app.decorate("guidedLearningApiHandlers", runtime.guidedLearningHandlers);
  app.addHook("onClose", async () => {
    runtime.database.close();
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "api-platform-shell",
    wave: 1,
    schema_version: "api.v1",
  }));

  app.post("/api/v1/guided-learning/sessions", async (request, reply) => {
    const body = request.body as
      | {
          project_id?: unknown;
          document_version_id?: unknown;
          learning_goal?: unknown;
          provider_config?: unknown;
        }
      | undefined;
    return runtime.guidedLearningHandlers
      .handle(requestId(request.id), () => {
        if (
          !body ||
          typeof body.project_id !== "string" ||
          typeof body.document_version_id !== "string" ||
          typeof body.learning_goal !== "string"
        )
          throw validationError(
            "project_id, document_version_id and learning_goal are required",
          );
          return runtime.guidedLearningHandlers.create({
            project_id: body.project_id,
            document_version_id: body.document_version_id,
            learning_goal: body.learning_goal,
            provider_config: parseProvider(body.provider_config),
        });
      })
      .then((result) => reply.code(result.statusCode).send(result.body));
  });

  app.get(
    "/api/v1/guided-learning/sessions/:sessionId",
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId?: string };
      return runtime.guidedLearningHandlers
        .handle(requestId(request.id), () => {
          if (!sessionId) throw validationError("sessionId is required");
          return runtime.guidedLearningHandlers.get(sessionId);
        })
        .then((result) => reply.code(result.statusCode).send(result.body));
    },
  );

  app.get(
    "/api/v1/document-versions/:documentVersionId/content",
    async (request, reply) => {
      const { documentVersionId } = request.params as { documentVersionId?: string };
      try {
        requireId(documentVersionId, "docv_");
        const query = request.query as { page?: string };
        if (query.page !== undefined) {
          const page = Number(query.page);
          const version = runtime.storage.getDocumentVersion(documentVersionId);
          if (!Number.isInteger(page) || page < 1 || !version || page > Number(version.page_count))
            return reply.code(400).send({ error: "The requested PDF page is invalid." });
        }
        const content = await runtime.documentIngest.readPdf(documentVersionId);
        if (!content) return reply.code(404).send({ error: "Document version content not found." });
        return reply
          .type("application/pdf")
          .header("content-disposition", "inline")
          .send(content);
      } catch {
        return reply.code(400).send({ error: "Document version id is invalid." });
      }
    },
  );

  app.post(
    "/api/v1/guided-learning/sessions/:sessionId/commands",
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId?: string };
      const body = request.body as
        | {
            contract_version?: unknown;
            event?: unknown;
            payload?: unknown;
            idempotency_key?: unknown;
          }
        | undefined;
      return runtime.guidedLearningHandlers
        .handle(requestId(request.id), () => {
          if (
            !sessionId ||
            !body ||
            typeof body.contract_version !== "string" ||
            typeof body.event !== "string" ||
            typeof body.idempotency_key !== "string" ||
            body.payload === undefined
          )
            throw validationError(
              "contract_version, event, payload and idempotency_key are required",
            );
          return runtime.guidedLearningHandlers.command(sessionId, {
            contract_version: body.contract_version,
            event: body.event,
            payload: body.payload,
            idempotency_key: body.idempotency_key,
          });
        })
        .then((result) => reply.code(result.statusCode).send(result.body));
    },
  );

  app.addContentTypeParser(
    "application/pdf",
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );

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

  app.delete("/api/v1/byok/session-key/:handle", async (request) => {
    const params = request.params as { handle?: string };
    return runtime.byokConnectionTestApi.clearSessionKey(params.handle ?? "");
  });

  app.post("/api/v1/byok/connection-test", async (request, reply) => {
    try {
      const result = await runtime.byokConnectionTestApi.testConnection(
        request.body as never,
      );
      return reply.code(result.status_code).send({
        schema_version: "api.v1",
        request_id: requestId(request.id),
        data: result.body,
      });
    } catch {
      return reply
        .code(400)
        .send({ error: "The connection-test request is invalid." });
    }
  });

  app.post("/api/v1/byok/environment-connection-test", async (request, reply) => {
    try {
      const body = request.body as { provider_config?: unknown } | undefined;
      const provider = parseProvider(body?.provider_config);
      if (provider.provider === "MOCK")
        return reply.code(400).send({ error: "A BYOK provider is required." });
      const result = await runtime.byokConnectionTestApi.testConnection({
        schema_version: "model-gateway.v1",
        message_kind: "REQUEST",
        operation: "CONNECTION_TEST",
        provider_config: provider,
        runtime_secret_ref: {
          kind: "ENVIRONMENT",
          name: "WORKFLOW_BYOK_API_KEY",
        },
        input: { probe: true },
      } as never);
      return reply.code(result.status_code).send({
        schema_version: "api.v1",
        request_id: requestId(request.id),
        data: result.body,
      });
    } catch {
      return reply
        .code(400)
        .send({ error: "The environment connection-test request is invalid." });
    }
  });

  app.post("/api/v1/projects", async (request, reply) => {
    const body = request.body as { name?: unknown } | undefined;
    return sendHandled(reply, requestId(request.id), () => {
      if (!body || typeof body.name !== "string")
        throw validationError("Project name is required");
      return runtime.workflowHttp.createProject(body.name);
    });
  });

  app.get("/api/v1/projects/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    return sendHandled(reply, requestId(request.id), () => {
      requireId(projectId, "proj_");
      return runtime.workflowHttp.getProject(projectId);
    });
  });

  app.get("/api/v1/projects/:projectId/snapshot", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    return sendHandled(reply, requestId(request.id), () => {
      requireId(projectId, "proj_");
      return runtime.workflowHttp.getProjectSnapshot(projectId);
    });
  });

  app.post("/api/v1/projects/:projectId/documents", async (request, reply) => {
    const { projectId } = request.params as { projectId?: string };
    const filename = request.headers["x-filename"];
    const idempotencyKey = request.headers["idempotency-key"];
    return sendHandled(reply, requestId(request.id), async () => {
      requireId(projectId, "proj_");
      if (typeof filename !== "string" || filename.length === 0)
        throw validationError("x-filename is required");
      if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0)
        throw validationError("Idempotency-Key is required");
      if (!(request.body instanceof Buffer))
        throw validationError("A PDF request body is required");
      const job = await runtime.documentIngest.upload({
        projectId,
        title: filename,
        file: {
          filename,
          contentType: String(request.headers["content-type"] ?? ""),
          bytes: request.body,
        },
        idempotencyKey,
      });
      return {
        document_id: job.payload.documentId,
        document_version_id: job.payload.documentVersionId,
        job_id: job.jobId,
      };
    });
  });

  app.get("/api/v1/documents/:documentId", async (request, reply) => {
    const { documentId } = request.params as { documentId?: string };
    return sendHandled(reply, requestId(request.id), () => {
      requireId(documentId, "doc_");
      return runtime.workflowHttp.getDocument(documentId);
    });
  });

  app.get("/api/v1/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId?: string };
    return sendHandled(reply, requestId(request.id), () => {
      requireId(jobId, "job_");
      return runtime.workflowHttp.getJob(jobId);
    });
  });

  app.post(
    "/api/v1/document-versions/:documentVersionId/question-plans",
    async (request, reply) => {
      const { documentVersionId } = request.params as {
        documentVersionId?: string;
      };
      const body = request.body as
        | {
            document_language?: unknown;
            provider_config?: unknown;
            idempotency_key?: unknown;
          }
        | undefined;
      return sendHandled(reply, requestId(request.id), () => {
        requireId(documentVersionId, "docv_");
        if (
          !body ||
          typeof body.document_language !== "string" ||
          typeof body.idempotency_key !== "string"
        )
          throw validationError(
            "document_language and idempotency_key are required",
          );
        return runtime.workflowHttp.enqueueQuestionPlan({
          documentVersionId,
          documentLanguage: body.document_language,
          providerConfig: parseProvider(body.provider_config),
          idempotencyKey: body.idempotency_key,
        });
      });
    },
  );

  app.get(
    "/api/v1/document-versions/:documentVersionId/question-plan",
    async (request, reply) => {
      const { documentVersionId } = request.params as {
        documentVersionId?: string;
      };
      return sendHandled(reply, requestId(request.id), () => {
        requireId(documentVersionId, "docv_");
        return runtime.workflowHttp.getQuestionPlan(documentVersionId);
      });
    },
  );

  app.get("/api/v1/questions/:questionId", async (request, reply) => {
    const { questionId } = request.params as { questionId?: string };
    return sendHandled(reply, requestId(request.id), () => {
      requireId(questionId, "question_");
      return runtime.workflowHttp.getQuestion(questionId);
    });
  });

  app.patch("/api/v1/questions/:questionId", async (request, reply) => {
    const { questionId } = request.params as { questionId?: string };
    const body = request.body as
      | { revision_id?: unknown; text?: unknown }
      | undefined;
    return sendHandled(reply, requestId(request.id), (service) => {
      requireId(questionId, "question_");
      if (
        !body ||
        typeof body.revision_id !== "string" ||
        typeof body.text !== "string"
      )
        throw validationError("revision_id and text are required");
      return service.editQuestion(questionId, body.revision_id, body.text);
    });
  });

  for (const action of ["confirm", "reject"] as const) {
    app.post(
      `/api/v1/questions/:questionId/${action}`,
      async (request, reply) => {
        const { questionId } = request.params as { questionId?: string };
        const body = request.body as { revision_id?: unknown } | undefined;
        return sendHandled(reply, requestId(request.id), (service) => {
          requireId(questionId, "question_");
          if (!body || typeof body.revision_id !== "string")
            throw validationError("revision_id is required");
          return action === "confirm"
            ? service.confirmQuestion(questionId, body.revision_id)
            : service.rejectQuestion(questionId, body.revision_id);
        });
      },
    );
  }

  app.post("/api/v1/questions/:questionId/answers", async (request, reply) => {
    const { questionId } = request.params as { questionId?: string };
    const body = request.body as
      | {
          provider_config?: unknown;
          idempotency_key?: unknown;
        }
      | undefined;
    return sendHandled(reply, requestId(request.id), () => {
      requireId(questionId, "question_");
      if (!body || typeof body.idempotency_key !== "string")
        throw validationError("idempotency_key is required");
      return runtime.workflowHttp.enqueueAnswer({
        questionId,
        providerConfig: parseProvider(body.provider_config),
        idempotencyKey: body.idempotency_key,
      });
    });
  });

  app.get("/api/v1/answers/:answerId", async (request, reply) => {
    const { answerId } = request.params as { answerId?: string };
    return sendHandled(reply, requestId(request.id), () => {
      requireId(answerId, "answer_");
      return runtime.workflowHttp.getAnswer(answerId);
    });
  });

  app.patch("/api/v1/answers/:answerId", async (request, reply) => {
    const { answerId } = request.params as { answerId?: string };
    const body = request.body as
      | {
          revision_id?: unknown;
          draft?: unknown;
        }
      | undefined;
    return sendHandled(reply, requestId(request.id), () => {
      requireId(answerId, "answer_");
      if (!body || typeof body.revision_id !== "string" || !body.draft)
        throw validationError("revision_id and draft are required");
      return runtime.workflowHttp.editAnswer({
        answerId,
        expectedRevisionId: body.revision_id,
        draft: body.draft as never,
      });
    });
  });

  for (const action of ["confirm", "reject"] as const) {
    app.post(`/api/v1/answers/:answerId/${action}`, async (request, reply) => {
      const { answerId } = request.params as { answerId?: string };
      const body = request.body as { revision_id?: unknown } | undefined;
      return sendHandled(reply, requestId(request.id), (service) => {
        requireId(answerId, "answer_");
        if (!body || typeof body.revision_id !== "string")
          throw validationError("revision_id is required");
        return action === "confirm"
          ? service.confirmAnswer(answerId, body.revision_id)
          : service.rejectAnswer(answerId, body.revision_id);
      });
    });
  }

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
}

function requestId(value: string): string {
  return `req_${value.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function requireId(
  value: string | undefined,
  prefix: string,
): asserts value is string {
  if (!value?.startsWith(prefix))
    throw validationError("Resource ID is invalid");
}

function validationError(message: string) {
  return Object.assign(new Error(message), { code: "VALIDATION_ERROR" });
}

function parseProvider(value: unknown) {
  if (value === undefined)
    return { provider: "MOCK" as const, fixture_id: "guided-learning-v1" };
  if (typeof value !== "object" || value === null)
    throw validationError("A model configuration is required");
  const config = value as Record<string, unknown>;
  if (config.provider === "MOCK" && typeof config.fixture_id === "string")
    return { provider: "MOCK" as const, fixture_id: config.fixture_id };
  if (
    [
      "OPENAI",
      "GEMINI",
      "GROQ",
      "OPENROUTER",
      "CUSTOM_OPENAI_COMPATIBLE",
    ].includes(String(config.provider)) &&
    typeof config.base_url === "string" &&
    typeof config.model === "string" &&
    Number.isInteger(config.request_timeout_ms) &&
    Number.isInteger(config.max_input_characters) &&
    Number.isInteger(config.max_output_tokens)
  ) {
    let url: URL;
    try {
      url = new URL(config.base_url);
    } catch {
      throw validationError("Model base_url is invalid");
    }
    if (url.protocol !== "https:" || url.search || url.hash)
      throw validationError("Model base_url must be HTTPS without query or fragment");
    if (
      Number(config.request_timeout_ms) < 1000 ||
      Number(config.request_timeout_ms) > 120000 ||
      Number(config.max_input_characters) < 1 ||
      Number(config.max_input_characters) > 10000000 ||
      Number(config.max_output_tokens) < 1 ||
      Number(config.max_output_tokens) > 100000
    )
      throw validationError("Model configuration limits are invalid");
    return {
      provider: config.provider as
        | "OPENAI"
        | "GEMINI"
        | "GROQ"
        | "OPENROUTER"
        | "CUSTOM_OPENAI_COMPATIBLE",
      base_url: config.base_url,
      model: config.model,
      request_timeout_ms: Number(config.request_timeout_ms),
      max_input_characters: Number(config.max_input_characters),
      max_output_tokens: Number(config.max_output_tokens),
    };
  }
  throw validationError("Model configuration is invalid");
}
