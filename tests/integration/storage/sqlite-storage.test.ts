import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  databaseSettings,
  openDatabase,
} from "../../../packages/storage/src/index.js";
import { StorageRepository } from "../../../packages/storage/src/repository.js";

const migrationDirectory = resolve("apps/api/migrations");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "research-reading-storage-"));
  temporaryDirectories.push(directory);
  return join(directory, "wave1.sqlite");
}

describe("SQLite storage", () => {
  it("initializes deterministic settings and applies a migration once", () => {
    const database = openDatabase(databasePath(), {
      migrationsDirectory: migrationDirectory,
    });
    expect(databaseSettings(database)).toEqual({
      journalMode: "wal",
      foreignKeys: 1,
      busyTimeout: 5000,
    });
    expect(
      database.prepare("SELECT version FROM schema_migrations").all(),
    ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }]);
    database.close();
  });

  it("creates the minimum records and reads them after reconnecting", () => {
    const path = databasePath();
    let database = openDatabase(path, {
      migrationsDirectory: migrationDirectory,
    });
    let repository = new StorageRepository(database);
    repository.createProject("proj_one", "Methods");
    repository.createDocument("doc_one", "proj_one", "Paper");
    repository.createDocumentVersion({
      documentVersionId: "docv_one",
      documentId: "doc_one",
      sourceSha256: "a".repeat(64),
      pageCount: 2,
      extractionProfileVersion: "1",
    });
    const pages = ["Methods 😀", "Results and discussion"].map(
      (canonicalPageText, index) => ({
        pageNumber: index + 1,
        canonicalPageText,
        pageTextSha256: createHash("sha256")
          .update(canonicalPageText, "utf8")
          .digest("hex"),
        extractionProfileVersion: "1",
        codePointLength: Array.from(canonicalPageText).length,
      }),
    );
    repository.saveDocumentPages("docv_one", pages);
    repository.createQuestion({
      questionPlanId: "qplan_one",
      documentVersionId: "docv_one",
      documentLanguage: "en",
      questionId: "question_one",
      revisionId: "qrev_one",
      text: "What method was used?",
      contentHash: "b".repeat(64),
      createdBy: "MODEL",
    });
    repository.createAnswer({
      answerId: "answer_one",
      questionId: "question_one",
      revisionId: "arev_one",
      content: { claims: [] },
      contentHash: "c".repeat(64),
      createdBy: "MODEL",
    });
    repository.createEvidenceSpan({
      evidenceSpanId: "evidence_one",
      documentVersionId: "docv_one",
      pageNumber: 1,
      charStart: 0,
      charEnd: 6,
      quote: "Method",
      pageTextSha256: "d".repeat(64),
      extractionProfileVersion: "1",
    });
    database.close();

    database = openDatabase(path, { migrationsDirectory: migrationDirectory });
    repository = new StorageRepository(database);
    expect(repository.getProject("proj_one")?.name).toBe("Methods");
    expect(repository.getDocumentVersion("docv_one")?.page_count).toBe(2);
    expect(repository.getDocumentPages("docv_one")).toEqual(
      pages.map((page) => ({
        documentVersionId: "docv_one",
        ...page,
      })),
    );
    expect(repository.getQuestion("question_one")?.text).toBe(
      "What method was used?",
    );
    expect(
      database
        .prepare("SELECT review_status FROM answers WHERE answer_id = ?")
        .get("answer_one"),
    ).toEqual({ review_status: "DRAFT" });
    expect(
      database
        .prepare("SELECT quote FROM evidence_spans WHERE evidence_span_id = ?")
        .get("evidence_one"),
    ).toEqual({ quote: "Method" });
    database.close();
  });
});
