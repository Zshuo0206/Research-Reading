import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const TARGET_DATABASE =
  "D:\\Research-Reading-Acceptance\\wave1-manual\\run.sqlite";
const TARGET_SESSION = "learning_95664836-e2bb-4c74-9e07-496448c0e3e1";
const EXPECTED_REVISION = 11;
const REPAIRED_REVISION = 12;

function printSummary(label, session, failure) {
  console.log(
    `[repair] ${label} session_id=${TARGET_SESSION} state=${session?.state ?? "<missing>"} revision=${session?.session_revision ?? "<missing>"} current_question_order=${session?.current_question_order ?? "<missing>"} failure_operation=${failure?.failed_operation ?? session?.failure?.failed_operation ?? "<none>"}`,
  );
}

function fail(message) {
  console.error(`[repair] ${message}`);
  process.exitCode = 1;
}

function parseSnapshot(row) {
  try {
    return JSON.parse(String(row.snapshot_json));
  } catch {
    throw new Error("snapshot_json is not valid JSON");
  }
}

function isAlreadyRepaired(session, failure) {
  return (
    session?.session_id === TARGET_SESSION &&
    session.state === "RETRYABLE_FAILURE" &&
    session.session_revision === REPAIRED_REVISION &&
    session.failure?.failure_class === "RETRYABLE" &&
    session.failure?.failed_operation === "GENERATE_FEEDBACK" &&
    session.failure?.resume_state === "ANSWER_SUBMITTED" &&
    failure?.failed_operation === "GENERATE_FEEDBACK" &&
    failure?.resume_state === "ANSWER_SUBMITTED" &&
    failure?.retryable === 1 &&
    failure?.superseded_at === null
  );
}

function assertPreconditions(row, session, failure) {
  const question = session.questions?.find(
    (item) => item.order === session.current_question_order,
  );
  const checks = [
    ["session row", row?.session_id === TARGET_SESSION],
    ["state", session.state === "FAILED" && row.current_state === "FAILED"],
    [
      "revision",
      session.session_revision === EXPECTED_REVISION &&
        Number(row.revision) === EXPECTED_REVISION,
    ],
    ["current_stage_id", session.current_stage_id === "UNDERSTAND"],
    ["current_question_order", session.current_question_order === 1],
    ["current question", Boolean(question)],
    [
      "user_answer",
      typeof question?.user_answer === "string" &&
        question.user_answer.length > 0,
    ],
    [
      "failure message",
      session.failure?.message === "Feedback question pointer changed",
    ],
    [
      "failure operation",
      session.failure?.failed_operation === "GENERATE_FEEDBACK",
    ],
    [
      "failure resume state",
      session.failure?.resume_state === "ANSWER_SUBMITTED",
    ],
    [
      "active failure",
      failure?.session_id === TARGET_SESSION && failure?.superseded_at === null,
    ],
    [
      "failure operation projection",
      failure?.failed_operation === "GENERATE_FEEDBACK",
    ],
    ["failure resume projection", failure?.resume_state === "ANSWER_SUBMITTED"],
    [
      "failure message projection",
      failure?.error_message === "Feedback question pointer changed",
    ],
    ["permanent failure projection", failure?.retryable === 0],
  ];
  const failed = checks.find(([, valid]) => !valid);
  if (failed) throw new Error(`precondition_failed field=${failed[0]}`);
  return question;
}

const databasePath = resolve(TARGET_DATABASE);
if (!existsSync(databasePath)) {
  fail("allowlisted database does not exist");
} else {
  let database;
  try {
    database = new DatabaseSync(databasePath);
    database.exec("PRAGMA foreign_keys = ON");
    const sessionRow = database
      .prepare("SELECT * FROM guided_learning_sessions WHERE session_id = ?")
      .get(TARGET_SESSION);
    const failureRow = database
      .prepare(
        `SELECT * FROM guided_learning_failures
         WHERE session_id = ? AND superseded_at IS NULL
         ORDER BY failed_at DESC LIMIT 1`,
      )
      .get(TARGET_SESSION);
    const session = sessionRow ? parseSnapshot(sessionRow) : undefined;
    printSummary("before", session, failureRow);

    if (isAlreadyRepaired(session, failureRow)) {
      console.log("[repair] already_repaired no changes applied");
    } else {
      const question = assertPreconditions(sessionRow, session, failureRow);
      const repaired = {
        ...session,
        state: "RETRYABLE_FAILURE",
        session_revision: REPAIRED_REVISION,
        state_version: Number(session.state_version) + 1,
        failure: {
          ...session.failure,
          failure_class: "RETRYABLE",
          error_code: "GENERATION_FAILED",
        },
        updated_at: new Date().toISOString(),
      };
      database.exec("BEGIN IMMEDIATE");
      try {
        const sessionUpdate = database
          .prepare(
            `UPDATE guided_learning_sessions
             SET current_state = ?, current_stage = ?, current_question_id = ?,
                 revision = ?, state_version = ?, snapshot_json = ?, updated_at = ?
             WHERE session_id = ? AND current_state = ? AND revision = ?`,
          )
          .run(
            repaired.state,
            repaired.current_stage_id,
            question.question_id,
            repaired.session_revision,
            repaired.state_version,
            JSON.stringify(repaired),
            repaired.updated_at,
            TARGET_SESSION,
            "FAILED",
            EXPECTED_REVISION,
          );
        if (sessionUpdate.changes !== 1)
          throw new Error("session update conflict");
        const failureUpdate = database
          .prepare(
            `UPDATE guided_learning_failures
             SET error_code = ?, retryable = 1
             WHERE failure_id = ? AND session_id = ?
               AND failed_operation = ? AND resume_state = ?
               AND error_message = ? AND retryable = 0
               AND superseded_at IS NULL`,
          )
          .run(
            "GENERATION_FAILED",
            failureRow.failure_id,
            TARGET_SESSION,
            "GENERATE_FEEDBACK",
            "ANSWER_SUBMITTED",
            "Feedback question pointer changed",
          );
        if (failureUpdate.changes !== 1)
          throw new Error("failure update conflict");
        database.exec("COMMIT");
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          // Preserve the original safe failure summary.
        }
        throw error;
      }
      const afterRow = database
        .prepare("SELECT * FROM guided_learning_sessions WHERE session_id = ?")
        .get(TARGET_SESSION);
      const afterFailure = database
        .prepare("SELECT * FROM guided_learning_failures WHERE failure_id = ?")
        .get(failureRow.failure_id);
      printSummary("after", parseSnapshot(afterRow), afterFailure);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : "repair failed");
  } finally {
    database?.close();
  }
}
