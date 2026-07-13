import { readFile } from "node:fs/promises";
import { handleExtractionJob } from "../extraction/handler.js";

export interface DocumentImportJobPayload {
  documentId: string;
  documentVersionId: string;
  sourceSha256: string;
  sourcePath: string;
}

export interface ExtractedPage {
  page_number: number;
  canonical_page_text: string;
  canonical_page_text_sha256: string;
}

export interface ExtractedDocument {
  source_sha256: string;
  page_count: number;
  extraction_profile: { version: string };
  pages: ExtractedPage[];
}

export type TextPdfExtractor = (
  bytes: Uint8Array,
) => ExtractedDocument | Promise<ExtractedDocument>;

export function createDocumentImportJobHandler(extract: TextPdfExtractor) {
  return async (payload: unknown): Promise<ExtractedDocument> => {
    const input = parsePayload(payload);
    const sourceBytes = await readFile(input.sourcePath);
    const result = await handleExtractionJob(
      {
        job_id: input.documentVersionId,
        kind: "DOCUMENT_EXTRACTION",
        source_sha256: input.sourceSha256,
        source_bytes: sourceBytes,
      },
      extract,
    );
    if (result.status === "FAILED") {
      const error = new Error(`DOCUMENT_IMPORT ${result.error_code}`);
      Object.assign(error, { code: result.error_code });
      throw error;
    }
    if (result.output.source_sha256 !== input.sourceSha256)
      throw new Error("DOCUMENT_IMPORT source hash mismatch");
    return result.output;
  };
}

function parsePayload(value: unknown): DocumentImportJobPayload {
  if (
    !isRecord(value) ||
    typeof value.documentId !== "string" ||
    typeof value.documentVersionId !== "string" ||
    typeof value.sourceSha256 !== "string" ||
    typeof value.sourcePath !== "string"
  )
    throw new Error("Invalid DOCUMENT_IMPORT workflow payload");
  return value as unknown as DocumentImportJobPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
