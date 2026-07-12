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
  extraction_profile: typeof EXTRACTION_PROFILE & { pdfjs_version?: string };
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

function decodePdfLiteral(value: string): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      result += char;
      continue;
    }
    const next = value[++index];
    if (next === undefined) break;
    const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
    if (next in escapes) result += escapes[next];
    else if (next === "\n") continue;
    else if (/[0-7]/.test(next)) {
      let octal = next;
      while (octal.length < 3 && /[0-7]/.test(value[index + 1] ?? "")) octal += value[++index];
      result += String.fromCharCode(Number.parseInt(octal, 8));
    } else result += next;
  }
  return result;
}

function decodePdfHex(value: string): string {
  const normalized = value.replace(/\s/g, "");
  const bytes = Buffer.from(normalized.length % 2 === 0 ? normalized : `${normalized}0`, "hex");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let text = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) text += String.fromCharCode(bytes.readUInt16BE(index));
    return text;
  }
  return bytes.toString("latin1");
}

function extractTextOperators(stream: string): string[] {
  const items: string[] = [];
  const token = /\(((?:\\.|[^\\()])*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj|\[((?:[^\]"']|"[^"]*"|'[^']*')*)\]\s*TJ/g;
  for (const match of stream.matchAll(token)) {
    if (match[1] !== undefined) items.push(decodePdfLiteral(match[1]));
    else if (match[2] !== undefined) items.push(decodePdfHex(match[2]));
    else {
      const array = match[3] ?? "";
      for (const part of array.matchAll(/\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]+)>/g)) {
        items.push(part[1] !== undefined ? decodePdfLiteral(part[1]) : decodePdfHex(part[2] ?? ""));
      }
    }
  }
  return items;
}

/**
 * Extracts the deliberately narrow, uncompressed text-PDF subset used until the
 * shared dependency RFC can add pdfjs-dist. Unsupported filters fail closed.
 */
export function extractTextPdf(
  bytes: Uint8Array,
  limits: ExtractionLimits = DEFAULT_LIMITS,
  now: () => number = Date.now,
): ExtractedDocument {
  const started = now();
  if (bytes.byteLength > limits.maxBytes) throw new PdfIngestionError("PDF_LIMIT_EXCEEDED", "PDF exceeds byte limit");
  const raw = Buffer.from(bytes).toString("latin1");
  if (!raw.startsWith("%PDF-")) throw new PdfIngestionError("UNSUPPORTED_INPUT", "Input is not a PDF");
  if (!raw.includes("%%EOF")) throw new PdfIngestionError("INVALID_PDF", "PDF is truncated or damaged");
  if (/\/Encrypt\b/.test(raw)) throw new PdfIngestionError("ENCRYPTED_PDF", "Encrypted PDFs are unsupported");
  if (/\/Filter\s*\/(?!ASCIIHexDecode\b)/.test(raw)) throw new PdfIngestionError("UNSUPPORTED_INPUT", "Compressed or filtered PDF streams require pdfjs-dist");

  const pageObjects = [...raw.matchAll(/(\d+)\s+0\s+obj\s*<<([\s\S]*?)>>\s*endobj/g)].filter(
    (object) => /\/Type\s*\/Page\b/.test(object[2] ?? ""),
  );
  if (pageObjects.length === 0) throw new PdfIngestionError("INVALID_PDF", "PDF has no page objects");
  if (pageObjects.length > limits.maxPages) throw new PdfIngestionError("PDF_LIMIT_EXCEEDED", "PDF exceeds page limit");

  let total = 0;
  const pages = pageObjects.map((page, index) => {
    if (now() - started > limits.timeoutMs) throw new PdfIngestionError("EXTRACTION_TIMEOUT", "PDF extraction timed out");
    const dictionary = page[2] ?? "";
    const contents = dictionary.match(/\/Contents\s+(?:(\d+)\s+0\s+R|\[([^\]]+)\])/);
    const contentIds = contents?.[1]
      ? [contents[1]]
      : [...(contents?.[2] ?? "").matchAll(/(\d+)\s+0\s+R/g)].map((match) => match[1]);
    const items: string[] = [];
    for (const id of contentIds) {
      const object = raw.match(new RegExp(`(?:^|\\n)${id}\\s+0\\s+obj(?:(?!endobj)[\\s\\S])*?stream\\r?\\n([\\s\\S]*?)\\r?\\nendstream`, "m"));
      if (object?.[1]) items.push(...extractTextOperators(object[1]));
    }
    const text = canonicalizePageText(items);
    total += [...text].length;
    if (total > limits.maxCodePoints) throw new PdfIngestionError("PDF_LIMIT_EXCEEDED", "PDF exceeds text limit");
    return { page_number: index + 1, canonical_page_text: text, canonical_page_text_sha256: sha256(text), code_point_length: [...text].length };
  });
  if (pages.every((page) => page.code_point_length === 0)) throw new PdfIngestionError("NO_EXTRACTABLE_TEXT", "PDF contains no extractable text");
  return { source_sha256: sha256(bytes), page_count: pages.length, extraction_profile: EXTRACTION_PROFILE, pages };
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
