import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  MockModelGateway,
  OpenAICompatibleByokGateway,
} from "../../../packages/model-gateway/dist/index.js";
import {
  RuntimeSecretResolver,
  SessionMemorySecretStore,
} from "../../../packages/runtime-secrets/dist/index.js";
import {
  openDatabase,
  GuidedLearningSessionRepository,
  StorageRepository,
} from "../../../packages/storage/dist/index.js";
import {
  type JobHandler,
  JobRuntime,
  type RunnableJob,
} from "./runtime/job-runtime.js";
import {
  createAnswerGenerationJobHandler,
  createQuestionPlanJobHandler,
} from "./workflow/handlers.js";
import {
  createDocumentImportJobHandler,
  type TextPdfExtractor,
} from "./workflow/document-import.js";
import { createGuidedLearningJobHandlers } from "./workflow/guided-learning.js";
import type { GuidedLearningWorkerModelGateway } from "./workflow/guided-learning.js";

const migrationsDirectory = fileURLToPath(
  new URL("../../api/migrations/", import.meta.url),
);

export interface WorkerRuntime {
  database: DatabaseSync;
  jobRuntime: JobRuntime;
  handlers: Partial<Record<RunnableJob["kind"], JobHandler>>;
}

export function createWorkerRuntime(
  workerId = process.env.WORKER_ID ?? "worker-local",
  databasePath = process.env.SQLITE_DATABASE_PATH ?? ":memory:",
  options: {
    documentImportHandler?: JobHandler;
    guidedLearningGateway?: GuidedLearningWorkerModelGateway;
  } = {},
): WorkerRuntime {
  const database = openDatabase(databasePath, { migrationsDirectory });
  const storage = new StorageRepository(database);
  const mockGateway = new MockModelGateway();
  const byokGateway = new OpenAICompatibleByokGateway(
    new RuntimeSecretResolver(new SessionMemorySecretStore()),
  );
  const gateway = {
    invoke: (request: unknown) => {
      const provider = providerName(request);
      if (provider === "MOCK") return mockGateway.invoke(request as never);
      return byokGateway.invoke({
        ...(request as Record<string, unknown>),
        runtime_secret_ref: {
          kind: "ENVIRONMENT",
          name:
            process.env.WORKFLOW_BYOK_SECRET_NAME ?? "WORKFLOW_BYOK_API_KEY",
        },
      } as never);
    },
  };
  const documentImportHandler =
    options.documentImportHandler ??
    createDocumentImportJobHandler(defaultTextPdfExtractor);
  const handlers: Partial<Record<RunnableJob["kind"], JobHandler>> = {
    QUESTION_PLAN: createQuestionPlanJobHandler(gateway),
    ANSWER_GENERATION: createAnswerGenerationJobHandler(gateway),
    DOCUMENT_IMPORT: documentImportHandler,
    ...createGuidedLearningJobHandlers({
      repository: new GuidedLearningSessionRepository(database),
      storage,
      gateway: options.guidedLearningGateway ?? gateway,
    }),
  };

  return {
    database,
    handlers,
    jobRuntime: new JobRuntime(storage, workerId, handlers),
  };
}

const defaultTextPdfExtractor: TextPdfExtractor = async (bytes) => {
  const pdfModule = (await import(
    new URL("../../../packages/pdf/dist/index.js", import.meta.url).href
  )) as { extractTextPdf: TextPdfExtractor };
  return pdfModule.extractTextPdf(bytes);
};

function providerName(request: unknown): string {
  if (
    typeof request === "object" &&
    request !== null &&
    "provider_config" in request &&
    typeof request.provider_config === "object" &&
    request.provider_config !== null &&
    "provider" in request.provider_config &&
    typeof request.provider_config.provider === "string"
  )
    return request.provider_config.provider;
  return "";
}
