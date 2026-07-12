export interface RunnableJob {
  jobId: string;
  kind: "DOCUMENT_IMPORT" | "QUESTION_PLAN" | "ANSWER_GENERATION";
  payload: unknown;
}

export interface JobRuntimeStore {
  claimNextJob(workerId: string): RunnableJob | undefined;
  succeedJob(jobId: string, workerId: string, result: unknown): void;
  failJob(jobId: string, workerId: string, errorMessage: string): void;
}

export type JobHandler = (payload: unknown) => unknown | Promise<unknown>;

export class JobRuntime {
  constructor(
    private readonly store: JobRuntimeStore,
    private readonly workerId: string,
    private readonly handlers: Partial<Record<RunnableJob["kind"], JobHandler>>,
  ) {}

  async runOnce(): Promise<boolean> {
    const job = this.store.claimNextJob(this.workerId);
    if (!job) return false;
    try {
      const handler = this.handlers[job.kind];
      if (!handler) throw new Error(`No handler registered for ${job.kind}`);
      const result = await handler(job.payload);
      this.store.succeedJob(job.jobId, this.workerId, result);
    } catch (error) {
      this.store.failJob(job.jobId, this.workerId, conciseError(error));
    }
    return true;
  }
}

export const questionPlanSummaryHandler: JobHandler = (payload) => {
  if (!isRecord(payload) || typeof payload.documentVersionId !== "string")
    throw new Error("QUESTION_PLAN payload requires documentVersionId");
  return { documentVersionId: payload.documentVersionId, prepared: true };
};

function conciseError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
