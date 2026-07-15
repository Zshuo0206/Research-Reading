import { createHash } from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface UploadInput {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

export class UploadValidationError extends Error {
  constructor(
    public readonly code: "UNSUPPORTED_INPUT" | "PDF_LIMIT_EXCEEDED",
    message: string,
  ) {
    super(message);
  }
}

export function validatePdfUpload(
  input: UploadInput,
  maxBytes = 50 * 1024 * 1024,
): void {
  if (
    input.contentType.toLowerCase() !== "application/pdf" ||
    !input.filename.toLowerCase().endsWith(".pdf") ||
    Buffer.from(input.bytes.subarray(0, 5)).toString("ascii") !== "%PDF-"
  ) {
    throw new UploadValidationError(
      "UNSUPPORTED_INPUT",
      "multipart part must be an application/pdf PDF file",
    );
  }
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > maxBytes)
    throw new UploadValidationError(
      "PDF_LIMIT_EXCEEDED",
      "PDF upload exceeds size boundary",
    );
}

export async function saveContentAddressedPdf(
  root: string,
  input: UploadInput,
): Promise<{ sourceSha256: string; path: string; created: boolean }> {
  validatePdfUpload(input);
  const sourceSha256 = createHash("sha256").update(input.bytes).digest("hex");
  const directory = join(root, sourceSha256.slice(0, 2));
  const path = join(directory, `${sourceSha256}.pdf`);
  await mkdir(directory, { recursive: true });
  try {
    await stat(path);
    return { sourceSha256, path, created: false };
  } catch {}
  const temporary = join(directory, `.${sourceSha256}.${process.pid}.tmp`);
  await writeFile(temporary, input.bytes, { flag: "wx" });
  await rename(temporary, path);
  return { sourceSha256, path, created: true };
}
