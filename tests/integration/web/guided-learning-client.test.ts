import { describe, expect, it } from "vitest";
import {
  GuidedLearningApiClient,
  GuidedLearningApiError,
  pdfFrameKey,
  pdfSourceWithPage,
} from "../../../apps/web/src/features/guided-learning/api.js";
import {
  isGuidedLearningPendingState,
  pollUntil,
} from "../../../apps/web/src/features/guided-learning/polling.js";

const envelope = <T>(data: T) =>
  new Response(
    JSON.stringify({
      schema_version: "api.v1",
      request_id: "req_server",
      data,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

it("returns a base PDF content URL without a page fragment", () => {
  const client = new GuidedLearningApiClient("http://127.0.0.1:4310");

  expect(client.documentContentUrl("document_example")).toBe(
    "http://127.0.0.1:4310/api/v1/document-versions/document_example/content",
  );
});

it("adds exactly one page fragment to the active PDF source", () => {
  const serverSource =
    "http://127.0.0.1:4310/api/v1/document-versions/document_example/content";

  expect(pdfSourceWithPage(serverSource, 5)).toBe(`${serverSource}#page=5`);
  expect(pdfSourceWithPage(`${serverSource}#page=5`, 6)).toBe(
    `${serverSource}#page=6`,
  );
  expect(pdfSourceWithPage(`${serverSource}#page=5`, 5)).toBe(
    `${serverSource}#page=5`,
  );
  expect(pdfSourceWithPage("blob:http://localhost/preview#old", 5)).toBe(
    "blob:http://localhost/preview#page=5",
  );
});

it("changes the iframe key for a new page and a repeated same-page navigation", () => {
  const source =
    "http://127.0.0.1:4310/api/v1/document-versions/document_example/content#old";

  expect(pdfFrameKey(source, 5, 1)).toBe(
    "http://127.0.0.1:4310/api/v1/document-versions/document_example/content#page=5|reload=1",
  );
  expect(pdfFrameKey(source, 6, 2)).not.toBe(pdfFrameKey(source, 5, 1));
  expect(pdfFrameKey(source, 5, 2)).not.toBe(pdfFrameKey(source, 5, 1));
  expect(pdfFrameKey(source, 5, 2).match(/#page=/g)).toHaveLength(1);
});

describe("Guided Learning Web API client", () => {
  it("uses api.v1 envelopes for create/get/command and preserves request headers", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), init: init ?? {} });
      return envelope({ ok: true });
    }) as typeof fetch;
    const client = new GuidedLearningApiClient("http://api.test", fetcher);

    await client.createProject("论文项目");
    await client.getGuidedLearningSession("learning_1");
    await client.sendGuidedLearningCommand("learning_1", {
      event: "RETRY",
      payload: {},
    });

    expect(requests.map((request) => request.url)).toEqual([
      "http://api.test/api/v1/projects",
      "http://api.test/api/v1/guided-learning/sessions/learning_1",
      "http://api.test/api/v1/guided-learning/sessions/learning_1/commands",
    ]);
    expect(new Headers(requests[0]?.init.headers).get("x-request-id")).toMatch(
      /^web:request:/,
    );
    expect(JSON.parse(String(requests[2]?.init.body))).toMatchObject({
      contract_version: "guided-learning.v1",
      event: "RETRY",
      payload: {},
    });
  });

  it("separates business and network errors without exposing raw objects", async () => {
    const businessFetcher = (async () =>
      new Response(
        JSON.stringify({
          schema_version: "api.v1",
          request_id: "req_error",
          error: {
            code: "REVISION_CONFLICT",
            message: "Revision conflict\ninternal",
          },
        }),
        { status: 409 },
      )) as typeof fetch;
    await expect(
      new GuidedLearningApiClient("http://api.test", businessFetcher).getJob(
        "job_1",
      ),
    ).rejects.toMatchObject({
      kind: "business",
      code: "REVISION_CONFLICT",
      message: "Revision conflict internal",
    });

    const networkFetcher = (async () => {
      throw new Error("socket details");
    }) as typeof fetch;
    await expect(
      new GuidedLearningApiClient("http://api.test", networkFetcher).getJob(
        "job_1",
      ),
    ).rejects.toMatchObject({ kind: "network", code: "NETWORK_ERROR" });
  });

  it("surfaces a bounded PDF upload error as a readable business error", async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({
          schema_version: "api.v1",
          request_id: "req_pdf_limit",
          error: {
            code: "PDF_TOO_LARGE",
            message: "PDF 文件不能超过 32 MiB。",
            request_id: "req_pdf_limit",
            details: [],
          },
        }),
        { status: 413, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    const client = new GuidedLearningApiClient("http://api.test", fetcher);

    await expect(
      client.uploadPdf(
        "proj_1",
        new File([new Uint8Array([37, 80, 68, 70, 45])], "large.pdf", {
          type: "application/pdf",
        }),
      ),
    ).rejects.toMatchObject({
      kind: "business",
      code: "PDF_TOO_LARGE",
      status: 413,
      message: "PDF 文件不能超过 32 MiB。",
    });
  });
});

describe("Guided Learning polling", () => {
  it("stops on a stable server state and retries transient failures", async () => {
    const values = ["transient", "pending", "ready"];
    let reads = 0;
    const seenErrors: number[] = [];
    const result = await pollUntil(
      async () => {
        const value = values[reads++];
        if (value === "transient") throw new Error("temporary network error");
        return value;
      },
      (value) => value === "ready",
      {
        intervalMs: 1,
        sleep: async () => undefined,
        onError: (_error, count) => seenErrors.push(count),
      },
    );
    expect(result).toBe("ready");
    expect(reads).toBe(3);
    expect(seenErrors).toEqual([1]);
  });

  it("stops when aborted and recognizes only generation states as pending", () => {
    expect(isGuidedLearningPendingState("CREATED")).toBe(true);
    expect(isGuidedLearningPendingState("FEEDBACK_READY")).toBe(false);
    const controller = new AbortController();
    controller.abort();
    return expect(
      pollUntil(
        async () => "pending",
        () => false,
        {
          signal: controller.signal,
          sleep: async () => undefined,
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("fails after the bounded number of consecutive errors", async () => {
    let reads = 0;
    await expect(
      pollUntil(
        async () => {
          reads += 1;
          throw new GuidedLearningApiError(
            "offline",
            "network",
            "NETWORK_ERROR",
            0,
          );
        },
        () => false,
        { sleep: async () => undefined, maxConsecutiveFailures: 3 },
      ),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(reads).toBe(3);
  });
});
