/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export interface Wave1ContextAndEvidenceSpans {
schema_version: "evidence.v1"
spans: ({
context_span_id: string
document_version_id: string
page_number: number
char_start: number
char_end: number
text: string
page_text_sha256: string
extraction_profile_version: string
} | {
evidence_span_id: string
context_span_id?: string
document_version_id: string
page_number: number
page_text_sha256: string
extraction_profile_version: string
char_start: number
char_end: number
quote: string
verification_status: ("PENDING" | "VERIFIED" | "INVALID" | "INSUFFICIENT_EVIDENCE")
})[]
}
