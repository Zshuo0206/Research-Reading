import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { MockModelGateway } from "../../../packages/model-gateway/dist/index.js";
import { openDatabase, StorageRepository } from "../../../packages/storage/dist/index.js";
import {
  JobRuntime,
  type JobHandler,
  type RunnableJob,
} from "./runtime/job-runtime.js";
import {
  createAnswerGenerationJobHandler,
  createQuestionPlanJobHandler,
} from "./workflow/handlers.js";

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
): WorkerRuntime {
  const database = openDatabase(databasePath, { migrationsDirectory });
  const storage = new StorageRepository(database);
  const gateway = new MockModelGateway();
  const handlers: Partial<Record<RunnableJob["kind"], JobHandler>> = {
    QUESTION_PLAN: createQuestionPlanJobHandler(gateway),
    ANSWER_GENERATION: createAnswerGenerationJobHandler(gateway),
  };

  return {
    database,
    handlers,
    jobRuntime: new JobRuntime(storage, workerId, handlers),
  };
}
