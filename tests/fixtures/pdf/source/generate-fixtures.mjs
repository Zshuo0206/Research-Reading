import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
  "<< /Length 83 >>\nstream\nBT /F1 12 Tf 72 720 Td (Research Reading synthetic fixture.) Tj 0 -20 Td (Page one.) Tj ET\nendstream",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
  "<< /Length 101 >>\nstream\nBT /F1 12 Tf 72 720 Td <FEFF0055006E00690063006F006400650020D83DDE00002000630061006600E9> Tj ET\nendstream",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let pdf = "%PDF-1.4\n% synthetic CC0 fixture\n";
const offsets = [0];
for (let index = 0; index < objects.length; index += 1) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f\n`;
for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n\n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const bytes = Buffer.from(pdf, "latin1");
await writeFile(join(root, "synthetic-text.pdf"), bytes);
await writeFile(join(root, "synthetic-text.sha256"), `${createHash("sha256").update(bytes).digest("hex")}  synthetic-text.pdf\n`);
