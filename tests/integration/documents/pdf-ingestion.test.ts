import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { handleExtractionJob } from "../../../apps/worker/src/extraction/handler.js";
import { EXTRACTION_PROFILE, PdfIngestionError, extractTextPdf, sha256, validateContextSpan } from "../../../packages/pdf/src/index.js";

const fixture = fileURLToPath(new URL("../../fixtures/pdf/synthetic-text.pdf", import.meta.url));

describe("text PDF ingestion", () => {
  it("extracts canonical page text and stable hashes", async () => {
    const bytes = await readFile(fixture);
    const first = await extractTextPdf(bytes);
    const second = await extractTextPdf(bytes);
    expect(first).toEqual(second);
    expect(first.page_count).toBe(2);
    expect(first.pages[0]?.canonical_page_text).toBe("Research Reading synthetic fixture.\nPage one.");
    expect(first.pages[1]?.canonical_page_text).toBe("U n i c o d e = c a f Ø");
    expect(first.pages[1]?.code_point_length).toBe([...first.pages[1]!.canonical_page_text].length);
    expect(first.extraction_profile).toMatchObject(EXTRACTION_PROFILE);
    expect(first.extraction_profile.pdfjs_version).toMatch(/^\d+\./);
  });

  it.each([
    [Buffer.from("not pdf"), "UNSUPPORTED_INPUT"],
    [Buffer.from("%PDF-1.4 broken"), "INVALID_PDF"],
    [Buffer.from("%PDF-1.4\n1 0 obj << /Encrypt 2 0 R /Type /Page >> endobj\n%%EOF"), "ENCRYPTED_PDF"],
  ])("rejects unsupported input", async (bytes, code) => {
    await expect(extractTextPdf(bytes)).rejects.toEqual(expect.objectContaining({ code }));
  });

  it("rejects a pdfjs document with no extractable page text", async () => {
    const emptyPdfJs = async () => ({
      version: "6.1.200",
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({ getTextContent: async () => ({ items: [] }), cleanup: () => undefined }),
        }),
        destroy: async () => undefined,
      }),
    });
    await expect(extractTextPdf(Buffer.from("%PDF-empty"), undefined, emptyPdfJs)).rejects.toEqual(
      expect.objectContaining({ code: "NO_EXTRACTABLE_TEXT" }),
    );
  });

  it("uses Unicode code-point right-open ContextSpan coordinates", async () => {
    const text = "Unicode 😀 café";
    const page = {
      page_number: 2,
      canonical_page_text: text,
      canonical_page_text_sha256: sha256(text),
      code_point_length: [...text].length,
    };
    const span = {
      context_span_id: "context_unicode",
      document_version_id: "docv_fixture",
      page_number: 2,
      char_start: 8,
      char_end: 9,
      text: "😀",
      page_text_sha256: page.canonical_page_text_sha256,
      extraction_profile_version: "1",
    };
    expect(() => validateContextSpan(span, "docv_fixture", page)).not.toThrow();
    expect(() => validateContextSpan({ ...span, char_end: 10 }, "docv_fixture", page)).toThrow(PdfIngestionError);
    expect(() => validateContextSpan({ ...span, page_text_sha256: "0".repeat(64) }, "docv_fixture", page)).toThrow(PdfIngestionError);
  });

  it("maps worker handler success and stable failure boundaries", async () => {
    const bytes = await readFile(fixture);
    const success = await handleExtractionJob({ job_id: "job_ok", kind: "DOCUMENT_EXTRACTION", source_sha256: "x", source_bytes: bytes }, extractTextPdf);
    expect(success.status).toBe("SUCCEEDED");
    const failure = await handleExtractionJob({ job_id: "job_bad", kind: "DOCUMENT_EXTRACTION", source_sha256: "x", source_bytes: Buffer.from("bad") }, extractTextPdf);
    expect(failure).toEqual({ job_id: "job_bad", status: "FAILED", error_code: "UNSUPPORTED_INPUT", retryable: false });
  });
});
