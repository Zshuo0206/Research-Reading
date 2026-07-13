import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { OpenAICompatibleByokGateway } from "../../../packages/model-gateway/dist/index.js";
import {
  RuntimeSecretResolver,
  SessionMemorySecretStore,
} from "../../../packages/runtime-secrets/dist/index.js";
import {
  openDatabase,
  StorageRepository,
  WorkflowRepository,
} from "../../../packages/storage/dist/index.js";
import { ByokConnectionTestApi } from "./byok/connection-test.js";
import { DocumentIngestService } from "./document-ingest/service.js";
import { WorkflowApiHandlers } from "./workflow/handlers.js";
import { WorkflowHttpService } from "./workflow/http-service.js";
import { WorkflowService } from "./workflow/service.js";

const migrationsDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

export interface ApiRuntime {
  database: DatabaseSync;
  storage: StorageRepository;
  workflowService: WorkflowService;
  workflowHandlers: WorkflowApiHandlers;
  workflowHttp: WorkflowHttpService;
  documentIngest: DocumentIngestService;
  byokConnectionTestApi: ByokConnectionTestApi;
}

export function createApiRuntime(
  databasePath = process.env.SQLITE_DATABASE_PATH ?? ":memory:",
  contentRoot = process.env.CONTENT_STORAGE_ROOT ?? ".research-reading-content",
): ApiRuntime {
  const database = openDatabase(databasePath, { migrationsDirectory });
  const storage = new StorageRepository(database);
  const workflowService = new WorkflowService(
    storage,
    new WorkflowRepository(database),
  );
  const workflowHandlers = new WorkflowApiHandlers(workflowService);
  const sessionSecrets = new SessionMemorySecretStore();
  const gateway = new OpenAICompatibleByokGateway(
    new RuntimeSecretResolver(sessionSecrets),
  );

  return {
    database,
    storage,
    workflowService,
    workflowHandlers,
    workflowHttp: new WorkflowHttpService(
      database,
      storage,
      new WorkflowRepository(database),
      workflowService,
    ),
    documentIngest: new DocumentIngestService(storage, contentRoot),
    byokConnectionTestApi: new ByokConnectionTestApi(gateway, sessionSecrets),
  };
}
