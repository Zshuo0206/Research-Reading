import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  saveContentAddressedPdf,
  validatePdfUpload,
} from "../../../apps/api/src/document-ingest/upload.js";

const fixture = fileURLToPath(
  new URL("../../fixtures/pdf/synthetic-text.pdf", import.meta.url),
);

describe("PDF upload boundary", () => {
  it("validates multipart metadata and saves idempotently by content hash", async () => {
    const bytes = await readFile(fixture);
    const root = await mkdtemp(join(tmpdir(), "rr-pdf-"));
    const input = {
      filename: "paper.pdf",
      contentType: "application/pdf",
      bytes,
    };
    const first = await saveContentAddressedPdf(root, input);
    const second = await saveContentAddressedPdf(root, input);
    expect(first.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.created).toBe(true);
    expect(second).toEqual({ ...first, created: false });
  });

  it("rejects non-PDF multipart input", () => {
    expect(() =>
      validatePdfUpload({
        filename: "paper.txt",
        contentType: "text/plain",
        bytes: Buffer.from("hello"),
      }),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_INPUT" }));
  });
});
