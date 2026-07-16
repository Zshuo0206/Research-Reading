import type { DatabaseSync } from "node:sqlite";
import type {
  GuidedLearningEvent,
  GuidedLearningIdempotencyRecord,
  GuidedLearningSession,
  GuidedLearningState,
  GuidedLearningTransitionActor,
} from "../../contracts/dist/wave1/src/index.js";
import type { GuidedLearningGenerationJobPayload } from "./types.js";

type Row = Record<string, unknown>;

export interface GuidedLearningCommandRecord
  extends GuidedLearningIdempotencyRecord {
  result_json: string;
  created_at: string;
}

export interface GuidedLearningFailureRecord {
  failure_id: string;
  session_id: string;
  failed_operation: string;
  resume_state: string;
  error_code: string;
  error_message: string;
  retryable: boolean;
  failed_at: string;
  superseded_at: string | null;
}

export interface GuidedLearningCommandWrite {
  idempotency_key: string;
  session_id: string;
  event: GuidedLearningEvent;
  request_fingerprint: string;
  from_state: GuidedLearningState;
  to_state: GuidedLearningState;
  actor: GuidedLearningTransitionActor;
  result_revision: number;
  result: unknown;
  created_at: string;
}

export interface GuidedLearningSaveOptions {
  command?: GuidedLearningCommandWrite;
  supersedeActiveFailuresAt?: string;
  job?: GuidedLearningJobWrite;
}

export interface GuidedLearningJobWrite {
  job_id: string;
  kind: GuidedLearningGenerationJobPayload["operation"];
  payload: GuidedLearningGenerationJobPayload;
  idempotency_key: string;
  max_attempts?: number;
  created_at: string;
}

export class GuidedLearningStorageError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "REVISION_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "TRANSACTION_FAILED",
    message: string,
    readonly command?: GuidedLearningCommandRecord,
  ) {
    super(message);
    this.name = "GuidedLearningStorageError";
  }
}

export class GuidedLearningSessionRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(session: GuidedLearningSession, job?: GuidedLearningJobWrite): void {
    this.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO guided_learning_sessions
             (session_id, contract_version, project_id, document_version_id,
              learning_goal, current_state, current_stage, current_question_id,
              revision, state_version, snapshot_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          session.session_id,
          "guided-learning.v1",
          session.project_id,
          session.document_version_id,
          session.learning_goal,
          session.state,
          session.current_stage_id ?? null,
          currentQuestionId(session),
          session.session_revision,
          session.state_version,
          JSON.stringify(session),
          session.created_at,
          session.updated_at,
        );
      this.replaceProjection(session);
      if (job) this.insertJob(job);
    });
  }

  get(sessionId: string): GuidedLearningSession | undefined {
    const row = this.database
      .prepare(
        "SELECT snapshot_json FROM guided_learning_sessions WHERE session_id = ?",
      )
      .get(sessionId) as Row | undefined;
    if (!row) return undefined;
    return JSON.parse(String(row.snapshot_json)) as GuidedLearningSession;
  }

  save(
    session: GuidedLearningSession,
    expectedRevision: number,
    options: GuidedLearningSaveOptions = {},
  ): void {
    this.transaction(() => {
      if (options.command) {
        const prior = this.findCommand(options.command.idempotency_key);
        if (prior)
          throw new GuidedLearningStorageError(
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key already exists",
            prior,
          );
      }
      const updated = this.database
        .prepare(
          `UPDATE guided_learning_sessions
              SET current_state = ?, current_stage = ?, current_question_id = ?,
                  revision = ?, state_version = ?, snapshot_json = ?, updated_at = ?
            WHERE session_id = ? AND revision = ?`,
        )
        .run(
          session.state,
          session.current_stage_id ?? null,
          currentQuestionId(session),
          session.session_revision,
          session.state_version,
          JSON.stringify(session),
          session.updated_at,
          session.session_id,
          expectedRevision,
        );
      if (updated.changes !== 1)
        throw new GuidedLearningStorageError(
          "REVISION_CONFLICT",
          `Session ${session.session_id} revision changed`,
        );
      this.replaceProjection(session);
      if (options.command)
        this.database
          .prepare(
            `INSERT INTO guided_learning_commands
             (idempotency_key, session_id, event, request_fingerprint, from_state,
              to_state, actor, result_revision, result_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            options.command.idempotency_key,
            options.command.session_id,
            options.command.event,
            options.command.request_fingerprint,
            options.command.from_state,
            options.command.to_state,
            options.command.actor,
            options.command.result_revision,
            JSON.stringify(options.command.result),
            options.command.created_at,
          );
      if (options.supersedeActiveFailuresAt !== undefined)
        this.database
          .prepare(
            "UPDATE guided_learning_failures SET superseded_at = ? WHERE session_id = ? AND superseded_at IS NULL",
          )
          .run(options.supersedeActiveFailuresAt, session.session_id);
      if (options.job) this.insertJob(options.job);
    });
  }

  saveFailure(
    session: GuidedLearningSession,
    expectedRevision: number,
    failure: {
      failure_id: string;
      failed_operation: string;
      resume_state: string;
      error_code: string;
      error_message: string;
      retryable: boolean;
      failed_at: string;
    },
  ): void {
    this.transaction(() => {
      const updated = this.database
        .prepare(
          `UPDATE guided_learning_sessions
              SET current_state = ?, current_stage = ?, current_question_id = ?,
                  revision = ?, state_version = ?, snapshot_json = ?, updated_at = ?
            WHERE session_id = ? AND revision = ?`,
        )
        .run(
          session.state,
          session.current_stage_id ?? null,
          currentQuestionId(session),
          session.session_revision,
          session.state_version,
          JSON.stringify(session),
          session.updated_at,
          session.session_id,
          expectedRevision,
        );
      if (updated.changes !== 1)
        throw new GuidedLearningStorageError(
          "REVISION_CONFLICT",
          `Session ${session.session_id} revision changed`,
        );
      this.replaceProjection(session);
      this.database
        .prepare(
          `INSERT INTO guided_learning_failures
           (failure_id, session_id, failed_operation, resume_state, error_code,
            error_message, retryable, failed_at, superseded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          failure.failure_id,
          session.session_id,
          failure.failed_operation,
          failure.resume_state,
          failure.error_code,
          failure.error_message,
          failure.retryable ? 1 : 0,
          failure.failed_at,
        );
    });
  }

  findCommand(idempotencyKey: string): GuidedLearningCommandRecord | undefined {
    const row = this.database
      .prepare(
        "SELECT * FROM guided_learning_commands WHERE idempotency_key = ?",
      )
      .get(idempotencyKey) as Row | undefined;
    return row ? mapCommand(row) : undefined;
  }

  recordCommandResult(command: GuidedLearningCommandWrite): void {
    this.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO guided_learning_commands
           (idempotency_key, session_id, event, request_fingerprint, from_state,
            to_state, actor, result_revision, result_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          command.idempotency_key,
          command.session_id,
          command.event,
          command.request_fingerprint,
          command.from_state,
          command.to_state,
          command.actor,
          command.result_revision,
          JSON.stringify(command.result),
          command.created_at,
        );
    });
  }

  recordFailure(input: {
    failureId: string;
    sessionId: string;
    failedOperation: string;
    resumeState: string;
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
    failedAt: string;
  }): void {
    this.database
      .prepare(
        `INSERT INTO guided_learning_failures
         (failure_id, session_id, failed_operation, resume_state, error_code,
          error_message, retryable, failed_at, superseded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        input.failureId,
        input.sessionId,
        input.failedOperation,
        input.resumeState,
        input.errorCode,
        input.errorMessage,
        input.retryable ? 1 : 0,
        input.failedAt,
      );
  }

  listFailures(sessionId: string): GuidedLearningFailureRecord[] {
    return (
      this.database
        .prepare(
          "SELECT * FROM guided_learning_failures WHERE session_id = ? ORDER BY failed_at",
        )
        .all(sessionId) as Row[]
    ).map(mapFailure);
  }

  private replaceProjection(session: GuidedLearningSession): void {
    const sessionId = session.session_id;
    for (const table of [
      "guided_learning_directions",
      "guided_learning_questions",
      "guided_learning_answers",
      "guided_learning_feedback",
      "guided_learning_evidence",
    ])
      this.database
        .prepare(`DELETE FROM ${table} WHERE session_id = ?`)
        .run(sessionId);

    const directions = this.database.prepare(
      "INSERT INTO guided_learning_directions(session_id, direction_id, direction_json) VALUES (?, ?, ?)",
    );
    for (const direction of session.candidate_directions)
      directions.run(
        sessionId,
        direction.direction_id,
        JSON.stringify(direction),
      );

    const questions = this.database.prepare(
      "INSERT INTO guided_learning_questions(session_id, question_id, question_order, question_json) VALUES (?, ?, ?, ?)",
    );
    const answers = this.database.prepare(
      "INSERT INTO guided_learning_answers(session_id, question_id, answer_json) VALUES (?, ?, ?)",
    );
    const feedback = this.database.prepare(
      "INSERT INTO guided_learning_feedback(session_id, question_id, feedback_json) VALUES (?, ?, ?)",
    );
    const evidence = this.database.prepare(
      "INSERT INTO guided_learning_evidence(evidence_id, session_id, question_id, evidence_json) VALUES (?, ?, ?, ?)",
    );
    for (const question of session.questions ?? []) {
      const value = question as unknown as Row;
      questions.run(
        sessionId,
        question.question_id,
        question.order,
        JSON.stringify(question),
      );
      if (value.user_answer !== undefined)
        answers.run(
          sessionId,
          question.question_id,
          JSON.stringify({ user_answer: value.user_answer }),
        );
      if (value.feedback)
        feedback.run(
          sessionId,
          question.question_id,
          JSON.stringify(value.feedback),
        );
      for (const item of (Array.isArray(value.evidence)
        ? value.evidence
        : []) as Row[])
        evidence.run(
          String(item.evidence_span_id),
          sessionId,
          question.question_id,
          JSON.stringify(item),
        );
    }
  }

  private insertJob(job: GuidedLearningJobWrite): void {
    this.database
      .prepare(
        `INSERT INTO jobs
         (job_id, kind, state, payload_json, idempotency_key, attempt,
          max_attempts, created_at)
         VALUES (?, ?, 'QUEUED', ?, ?, 0, ?, ?)`,
      )
      .run(
        job.job_id,
        job.kind,
        JSON.stringify(job.payload),
        job.idempotency_key,
        job.max_attempts ?? 3,
        job.created_at,
      );
  }

  private transaction(operation: () => void): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      operation();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function currentQuestionId(session: GuidedLearningSession): string | null {
  const order = session.current_question_order;
  if (order === undefined) return null;
  return (
    session.questions?.find((question) => question.order === order)
      ?.question_id ?? null
  );
}

function mapCommand(row: Row): GuidedLearningCommandRecord {
  return {
    idempotency_key: String(row.idempotency_key),
    session_id: String(row.session_id),
    event: row.event as GuidedLearningEvent,
    request_fingerprint: String(row.request_fingerprint),
    from_state: row.from_state as GuidedLearningState,
    to_state: row.to_state as GuidedLearningState,
    actor: row.actor as GuidedLearningTransitionActor,
    result_revision: Number(row.result_revision),
    result_json: String(row.result_json),
    created_at: String(row.created_at),
  };
}

function mapFailure(row: Row): GuidedLearningFailureRecord {
  return {
    failure_id: String(row.failure_id),
    session_id: String(row.session_id),
    failed_operation: String(row.failed_operation),
    resume_state: String(row.resume_state),
    error_code: String(row.error_code),
    error_message: String(row.error_message),
    retryable: Number(row.retryable) === 1,
    failed_at: String(row.failed_at),
    superseded_at:
      row.superseded_at === null ? null : String(row.superseded_at),
  };
}
