import { createHash } from "node:crypto";

export const EXTRACTION_PROFILE = {
  name: "pdfjs-text-v1" as const,
  version: "1" as const,
  offset_unit: "unicode_code_point" as const,
  normalization: "NFKC" as const,
  whitespace: "LF_AND_ASCII_SPACE" as const,
  hyphenation: "PRESERVE" as const,
};

export type PdfFailureCode =
  | "UNSUPPORTED_INPUT"
  | "INVALID_PDF"
  | "ENCRYPTED_PDF"
  | "NO_EXTRACTABLE_TEXT"
  | "PDF_LIMIT_EXCEEDED"
  | "EXTRACTION_TIMEOUT";

export class PdfIngestionError extends Error {
  constructor(
    public readonly code: PdfFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfIngestionError";
  }
}

export interface ExtractionLimits {
  maxBytes: number;
  maxPages: number;
  maxCodePoints: number;
  timeoutMs: number;
}

export const DEFAULT_LIMITS: ExtractionLimits = {
  maxBytes: 50 * 1024 * 1024,
  maxPages: 300,
  maxCodePoints: 10_000_000,
  timeoutMs: 30_000,
};

export interface CanonicalPage {
  page_number: number;
  canonical_page_text: string;
  canonical_page_text_sha256: string;
  code_point_length: number;
}

export interface ExtractedDocument {
  source_sha256: string;
  page_count: number;
  extraction_profile: typeof EXTRACTION_PROFILE & { pdfjs_version: string };
  pages: CanonicalPage[];
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalizePageText(items: readonly string[]): string {
  return items
    .map((item) => item.normalize("NFKC").replace(/\r\n?/g, "\n"))
    .join(" ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

interface PdfJsPage {
  getTextContent(parameters?: { disableNormalization?: boolean }): Promise<{
    items: Array<{ str: string; hasEOL: boolean } | { type: string }>;
  }>;
  cleanup(): void;
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
}

interface PdfJsModule {
  version: string;
  getDocument(parameters: {
    data: Uint8Array;
    useSystemFonts: boolean;
    stopAtErrors: boolean;
  }): {
    promise: Promise<PdfJsDocument>;
    destroy(): Promise<void>;
  };
}

type PdfJsLoader = () => Promise<PdfJsModule>;

const loadPdfJs: PdfJsLoader = async () =>
  (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;

function classifyPdfJsError(error: unknown): PdfIngestionError {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException") return new PdfIngestionError("ENCRYPTED_PDF", "Encrypted PDFs are unsupported");
  if (name === "InvalidPDFException" || name === "MissingPDFException" || name === "UnexpectedResponseException") {
    return new PdfIngestionError("INVALID_PDF", "PDF is damaged or invalid");
  }
  return error instanceof PdfIngestionError
    ? error
    : new PdfIngestionError(
        "INVALID_PDF",
        `PDF extraction failed${error instanceof Error ? ` (${error.name}: ${error.message})` : ""}`,
      );
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new PdfIngestionError("EXTRACTION_TIMEOUT", "PDF extraction timed out")),
      timeoutMs,
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function extractTextPdf(
  bytes: Uint8Array,
  limits: ExtractionLimits = DEFAULT_LIMITS,
  pdfJsLoader: PdfJsLoader = loadPdfJs,
): Promise<ExtractedDocument> {
  if (bytes.byteLength > limits.maxBytes) throw new PdfIngestionError("PDF_LIMIT_EXCEEDED", "PDF exceeds byte limit");
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") throw new PdfIngestionError("UNSUPPORTED_INPUT", "Input is not a PDF");
  if (Buffer.from(bytes).includes(Buffer.from("/Encrypt"))) throw new PdfIngestionError("ENCRYPTED_PDF", "Encrypted PDFs are unsupported");

  const operation = (async () => {
    const pdfjs = await pdfJsLoader();
    const loadingTask = pdfjs.getDocument({
      data: Uint8Array.from(bytes),
      useSystemFonts: true,
      stopAtErrors: true,
    });
    try {
      const document = await loadingTask.promise;
      if (document.numPages > limits.maxPages) throw new PdfIngestionError("PDF_LIMIT_EXCEEDED", "PDF exceeds page limit");
      let totalCodePoints = 0;
      const pages: CanonicalPage[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent({ disableNormalization: true });
        const items: string[] = [];
        for (const item of content.items) {
          if (!("str" in item)) continue;
          items.push(item.str);
          if (item.hasEOL) items.push("\n");
        }
        const canonicalPageText = canonicalizePageText(items);
        const codePointLength = [...canonicalPageText].length;
        totalCodePoints += codePointLength;
        if (totalCodePoints > limits.maxCodePoints) throw new PdfIngestionError("PDF_LIMIT_EXCEEDED", "PDF exceeds text limit");
        pages.push({
          page_number: pageNumber,
          canonical_page_text: canonicalPageText,
          canonical_page_text_sha256: sha256(canonicalPageText),
          code_point_length: codePointLength,
        });
        page.cleanup();
      }
      if (pages.every((page) => page.code_point_length === 0)) throw new PdfIngestionError("NO_EXTRACTABLE_TEXT", "PDF contains no extractable text");
      return {
        source_sha256: sha256(bytes),
        page_count: pages.length,
        extraction_profile: { ...EXTRACTION_PROFILE, pdfjs_version: pdfjs.version },
        pages,
      };
    } finally {
      await loadingTask.destroy();
    }
  })();

  try {
    return await withTimeout(operation, limits.timeoutMs);
  } catch (error) {
    throw classifyPdfJsError(error);
  }
}

export interface ContextSpan {
  context_span_id: string;
  document_version_id: string;
  page_number: number;
  char_start: number;
  char_end: number;
  text: string;
  page_text_sha256: string;
  extraction_profile_version: string;
}

export function validateContextSpan(span: ContextSpan, documentVersionId: string, page: CanonicalPage): void {
  if (span.document_version_id !== documentVersionId || span.page_number !== page.page_number) throw new PdfIngestionError("INVALID_PDF", "ContextSpan document or page mismatch");
  if (span.page_text_sha256 !== page.canonical_page_text_sha256 || span.extraction_profile_version !== EXTRACTION_PROFILE.version) throw new PdfIngestionError("INVALID_PDF", "ContextSpan hash or profile mismatch");
  const points = [...page.canonical_page_text];
  if (!Number.isInteger(span.char_start) || !Number.isInteger(span.char_end) || span.char_start < 0 || span.char_start >= span.char_end || span.char_end > points.length) throw new PdfIngestionError("INVALID_PDF", "ContextSpan coordinates are invalid");
  if (points.slice(span.char_start, span.char_end).join("") !== span.text) throw new PdfIngestionError("INVALID_PDF", "ContextSpan quote mismatch");
}
