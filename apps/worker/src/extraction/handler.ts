export type ExtractionJob = {
  job_id: string;
  kind: "DOCUMENT_EXTRACTION";
  source_sha256: string;
  source_bytes: Uint8Array;
};

export type ExtractionJobResult<T> =
  | { job_id: string; status: "SUCCEEDED"; output: T }
  | { job_id: string; status: "FAILED"; error_code: string; retryable: false };

export async function handleExtractionJob<T>(
  job: ExtractionJob,
  extract: (bytes: Uint8Array) => T | Promise<T>,
): Promise<ExtractionJobResult<T>> {
  if (job.kind !== "DOCUMENT_EXTRACTION" || job.source_bytes.byteLength === 0) return { job_id: job.job_id, status: "FAILED", error_code: "UNSUPPORTED_INPUT", retryable: false };
  try {
    return { job_id: job.job_id, status: "SUCCEEDED", output: await extract(job.source_bytes) };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "INVALID_PDF";
    return { job_id: job.job_id, status: "FAILED", error_code: code, retryable: false };
  }
}
