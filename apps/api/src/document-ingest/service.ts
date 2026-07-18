import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { StorageRepository } from "../../../../packages/storage/dist/index.js";
import { saveContentAddressedPdf, type UploadInput } from "./upload.js";

export interface DocumentImportPayload {
  documentId: string;
  documentVersionId: string;
  sourceSha256: string;
  sourcePath: string;
}

export class DocumentIngestService {
  constructor(
    private readonly storage: StorageRepository,
    private readonly contentRoot: string,
  ) {}

  async upload(input: {
    projectId: string;
    title: string;
    file: UploadInput;
    idempotencyKey: string;
  }) {
    if (!this.storage.getProject(input.projectId)) {
      throw new DocumentIngestError("NOT_FOUND", "Project not found");
    }
    const saved = await saveContentAddressedPdf(this.contentRoot, input.file);
    const documentId = `doc_${randomUUID()}`;
    const documentVersionId = `docv_${randomUUID()}`;
    const jobId = `job_${randomUUID()}`;
    const payload: DocumentImportPayload = {
      documentId,
      documentVersionId,
      sourceSha256: saved.sourceSha256,
      sourcePath: saved.path,
    };
    const existing = this.storage.getJobByIdempotencyKey<DocumentImportPayload>(
      input.idempotencyKey,
    );
    if (existing) return existing;
    this.storage.createDocument(documentId, input.projectId, input.title);
    try {
      return this.storage.createJob({
        jobId,
        kind: "DOCUMENT_IMPORT",
        payload,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      const raced = this.storage.getJobByIdempotencyKey<DocumentImportPayload>(
        input.idempotencyKey,
      );
      if (raced) return raced;
      throw error;
    }
  }

  async readPdf(documentVersionId: string): Promise<Buffer> {
    const version = this.storage.getDocumentVersion(documentVersionId);
    if (!version)
      throw new DocumentIngestError(
        "NOT_FOUND",
        "Document version content was not found",
      );
    const sha = String(version.source_sha256);
    if (!/^[a-f0-9]{64}$/.test(sha))
      throw new DocumentIngestError(
        "STORAGE_UNAVAILABLE",
        "Document content metadata is unavailable",
      );
    try {
      return await readFile(
        join(this.contentRoot, sha.slice(0, 2), `${sha}.pdf`),
      );
    } catch {
      throw new DocumentIngestError(
        "STORAGE_UNAVAILABLE",
        "Document content storage is unavailable",
      );
    }
  }
}

export class DocumentIngestError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "STORAGE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "DocumentIngestError";
  }
}
