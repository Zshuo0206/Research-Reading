import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  JobRuntime,
  questionPlanSummaryHandler,
} from "../../../apps/worker/src/runtime/job-runtime.js";
import {
  openDatabase,
  StorageRepository,
} from "../../../packages/storage/src/index.js";

const migrationDirectory = resolve("apps/api/migrations");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "research-reading-jobs-"));
  temporaryDirectories.push(directory);
  const database = openDatabase(join(directory, "jobs.sqlite"), {
    migrationsDirectory: migrationDirectory,
  });
  return { database, repository: new StorageRepository(database) };
}

describe("Job runtime", () => {
  it("atomically claims once and completes a real handler", async () => {
    const { database, repository } = setup();
    repository.createJob({
      jobId: "job_success",
      kind: "QUESTION_PLAN",
      payload: { documentVersionId: "docv_one" },
      idempotencyKey: "plan:docv_one",
    });
    const claimed = repository.claimNextJob("worker_competitor");
    expect(claimed?.state).toBe("RUNNING");
    expect(repository.claimNextJob("worker_other")).toBeUndefined();
    repository.failJob("job_success", "worker_competitor", "released for test");

    repository.createJob({
      jobId: "job_handler",
      kind: "QUESTION_PLAN",
      payload: { documentVersionId: "docv_two" },
      idempotencyKey: "plan:docv_two",
    });
    const runtime = new JobRuntime(repository, "worker_one", {
      QUESTION_PLAN: questionPlanSummaryHandler,
    });
    expect(await runtime.runOnce()).toBe(true);
    expect(repository.getJob("job_handler")).toMatchObject({
      state: "SUCCEEDED",
      attempt: 1,
      result: { documentVersionId: "docv_two", prepared: true },
    });
    database.close();
  });

  it("records a concise handler failure and enforces transitions", async () => {
    const { database, repository } = setup();
    repository.createJob({
      jobId: "job_failure",
      kind: "QUESTION_PLAN",
      payload: {},
      idempotencyKey: "plan:bad",
    });
    const runtime = new JobRuntime(repository, "worker_one", {
      QUESTION_PLAN: questionPlanSummaryHandler,
    });
    expect(await runtime.runOnce()).toBe(true);
    expect(repository.getJob("job_failure")).toMatchObject({
      state: "FAILED",
      errorMessage: "QUESTION_PLAN payload requires documentVersionId",
    });
    expect(() =>
      repository.succeedJob("job_failure", "worker_one", {}),
    ).toThrow(/not owned/);
    database.close();
  });

  it("keeps completed jobs readable after reconnecting", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "research-reading-jobs-reopen-"),
    );
    temporaryDirectories.push(directory);
    const path = join(directory, "jobs.sqlite");
    let database = openDatabase(path, {
      migrationsDirectory: migrationDirectory,
    });
    let repository = new StorageRepository(database);
    repository.createJob({
      jobId: "job_reopen",
      kind: "QUESTION_PLAN",
      payload: { documentVersionId: "docv_three" },
      idempotencyKey: "plan:docv_three",
    });
    await new JobRuntime(repository, "worker_one", {
      QUESTION_PLAN: questionPlanSummaryHandler,
    }).runOnce();
    database.close();
    database = openDatabase(path, { migrationsDirectory: migrationDirectory });
    repository = new StorageRepository(database);
    expect(repository.getJob("job_reopen")?.state).toBe("SUCCEEDED");
    database.close();
  });
});
