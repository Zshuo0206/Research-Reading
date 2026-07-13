import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  openDatabase,
  StorageRepository,
  WorkflowRepository,
} from "../../../packages/storage/dist/index.js";
import { OpenAICompatibleByokGateway } from "../../../packages/model-gateway/dist/index.js";
import {
  RuntimeSecretResolver,
  SessionMemorySecretStore,
} from "../../../packages/runtime-secrets/dist/index.js";
import { ByokConnectionTestApi } from "./byok/connection-test.js";
import { WorkflowApiHandlers } from "./workflow/handlers.js";
import { WorkflowService } from "./workflow/service.js";

const migrationsDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);

export interface ApiRuntime {
  database: DatabaseSync;
  workflowService: WorkflowService;
  workflowHandlers: WorkflowApiHandlers;
  byokConnectionTestApi: ByokConnectionTestApi;
}

export function createApiRuntime(
  databasePath = process.env.SQLITE_DATABASE_PATH ?? ":memory:",
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
    workflowService,
    workflowHandlers,
    byokConnectionTestApi: new ByokConnectionTestApi(
      gateway,
      sessionSecrets,
    ),
  };
}
