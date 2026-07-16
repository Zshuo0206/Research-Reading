import type { GuidedLearningSession } from "../../../../../packages/contracts/wave1/src/index.js";
import type { GuidedLearningApiClient, WorkflowJob } from "./api.js";

export const GUIDED_LEARNING_PENDING_STATES = new Set([
  "CREATED",
  "QUESTIONS_GENERATING",
  "ANSWER_SUBMITTED",
  "SUMMARY_GENERATING",
] as const);

export function isGuidedLearningPendingState(
  state: GuidedLearningSession["state"],
): boolean {
  return GUIDED_LEARNING_PENDING_STATES.has(state as never);
}

export async function pollGuidedLearningSession(
  client: GuidedLearningApiClient,
  sessionId: string,
  options: PollOptions<GuidedLearningSession>,
) {
  return pollUntil(
    () => client.getGuidedLearningSession(sessionId),
    (session) => !isGuidedLearningPendingState(session.state),
    options,
  );
}

export async function pollWorkflowJob(
  client: GuidedLearningApiClient,
  jobId: string,
  options: PollOptions<WorkflowJob>,
) {
  return pollUntil(
    () => client.getJob(jobId),
    (job) => job.status === "SUCCEEDED" || job.status === "FAILED",
    options,
  );
}

export type PollOptions<T> = {
  intervalMs?: number;
  maxConsecutiveFailures?: number;
  signal?: AbortSignal;
  onValue?: (value: T) => void;
  onError?: (error: unknown, consecutiveFailures: number) => void;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
};

export async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  options: PollOptions<T> = {},
): Promise<T> {
  const intervalMs = options.intervalMs ?? 1500;
  const maxFailures = options.maxConsecutiveFailures ?? 3;
  const sleep = options.sleep ?? wait;
  let consecutiveFailures = 0;

  while (!options.signal?.aborted) {
    try {
      const value = await read();
      consecutiveFailures = 0;
      options.onValue?.(value);
      if (done(value)) return value;
    } catch (error) {
      consecutiveFailures += 1;
      options.onError?.(error, consecutiveFailures);
      if (consecutiveFailures >= maxFailures) throw error;
    }
    await sleep(intervalMs, options.signal);
  }
  throw abortError();
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function abortError(): DOMException {
  return new DOMException("Polling was aborted", "AbortError");
}
