import type {
  GuidedLearningCommandName,
  GuidedLearningSession,
} from "../../../../../packages/contracts/wave1/src/index.js";

export type ApiErrorKind = "network" | "business";

export class GuidedLearningApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "GuidedLearningApiError";
  }
}

type ApiEnvelope<T> = {
  schema_version: "api.v1";
  request_id: string;
  data?: T;
  error?: { code: string; message: string; request_id: string };
};

export type Project = { project_id: string; name: string };

export type UploadResult = {
  document_id: string;
  document_version_id: string;
  job_id: string;
};

export type WorkflowJob = {
  job_id: string;
  job_type: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  related: {
    project_id: string | null;
    document_id: string | null;
    document_version_id: string | null;
    question_id: string | null;
  };
  error: { code: string; message: string } | null;
};

export type CreateSessionResult = {
  session: GuidedLearningSession;
  job_id: string;
};
export type GuidedProviderConfig =
  | { provider: "MOCK"; fixture_id: string }
  | {
      provider: "OPENAI" | "GEMINI" | "GROQ" | "OPENROUTER" | "CUSTOM_OPENAI_COMPATIBLE";
      base_url: string;
      model: string;
      request_timeout_ms: number;
      max_input_characters: number;
      max_output_tokens: number;
    };

export type GuidedLearningCommandResult = {
  outcome: "APPLIED" | "IDEMPOTENT";
  transition: {
    from_state: GuidedLearningSession["state"];
    to_state: GuidedLearningSession["state"];
    result_revision: number;
  };
  session: GuidedLearningSession;
  job_id?: string;
};

type FetchLike = typeof fetch;

export class GuidedLearningApiClient {
  private readonly fetcher: FetchLike;
  private readonly baseUrl: string;

  constructor(
    baseUrl = (globalThis as { RESEARCH_READING_API_BASE_URL?: string })
      .RESEARCH_READING_API_BASE_URL ?? "http://127.0.0.1:4310",
    fetcher: FetchLike = globalThis.fetch.bind(globalThis),
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetcher = fetcher;
  }

  createProject(name: string) {
    return this.request<Project>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  uploadPdf(projectId: string, file: File) {
    return this.request<UploadResult>(
      `/api/v1/projects/${projectId}/documents`,
      {
        method: "POST",
        headers: {
          "content-type": file.type || "application/pdf",
          "x-filename": file.name,
          "idempotency-key": requestKey("pdf"),
        },
        body: file,
      },
    );
  }

  getJob(jobId: string) {
    return this.request<WorkflowJob>(`/api/v1/jobs/${jobId}`);
  }

  createGuidedLearningSession(input: {
    project_id: string;
    document_version_id: string;
    learning_goal: string;
    provider_config?: GuidedProviderConfig;
  }) {
    return this.request<CreateSessionResult>(
      "/api/v1/guided-learning/sessions",
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  testEnvironmentConnection(provider_config: Exclude<GuidedProviderConfig, { provider: "MOCK" }>) {
    return this.request<unknown>("/api/v1/byok/environment-connection-test", {
      method: "POST",
      body: JSON.stringify({ provider_config }),
    });
  }

  documentContentUrl(documentVersionId: string): string {
    return `${this.baseUrl}/api/v1/document-versions/${documentVersionId}/content`;
  }

  getGuidedLearningSession(sessionId: string) {
    return this.request<GuidedLearningSession>(
      `/api/v1/guided-learning/sessions/${sessionId}`,
    );
  }

  sendGuidedLearningCommand(
    sessionId: string,
    input: { event: GuidedLearningCommandName; payload: unknown },
  ) {
    return this.request<GuidedLearningCommandResult>(
      `/api/v1/guided-learning/sessions/${sessionId}/commands`,
      {
        method: "POST",
        body: JSON.stringify({
          contract_version: "guided-learning.v1",
          event: input.event,
          payload: input.payload,
          idempotency_key: requestKey(input.event),
        }),
      },
    );
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const requestId = requestKey("request");
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("x-request-id", requestId);
    if (init.body && !(init.body instanceof File))
      headers.set("content-type", "application/json");

    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers,
      });
    } catch {
      throw new GuidedLearningApiError(
        "无法连接到本地 API，请确认 API 服务正在运行。",
        "network",
        "NETWORK_ERROR",
        0,
        requestId,
      );
    }

    let body: ApiEnvelope<T> | undefined;
    try {
      body = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new GuidedLearningApiError(
        "服务返回了无法读取的响应。",
        "business",
        "INVALID_RESPONSE",
        response.status,
        requestId,
      );
    }

    if (!response.ok || body.error || body.data === undefined) {
      const error = body.error;
      throw new GuidedLearningApiError(
        safeMessage(error?.message ?? "请求未完成。"),
        "business",
        error?.code ?? `HTTP_${response.status}`,
        response.status,
        error?.request_id ?? body.request_id ?? requestId,
      );
    }
    return body.data;
  }
}

export function pdfSourceWithPage(source: string, page: number | null): string {
  if (page === null) return source;
  return `${source.split("#", 1)[0]}#page=${page}`;
}

function requestKey(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `web:${prefix}:${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function safeMessage(message: string): string {
  return message.replace(/[\r\n]+/g, " ").slice(0, 300);
}
