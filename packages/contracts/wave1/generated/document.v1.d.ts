/* Generated from packages/contracts/wave1 JSON Schema. Do not edit. */

export interface Wave1DocumentVersion {
schema_version: "document.v1"
document_version_id: string
project_id: string
source_sha256: string
page_count: number
extraction_profile: {
name: "pdfjs-text-v1"
version: "1"
pdfjs_version?: string
offset_unit: "unicode_code_point"
normalization: "NFKC"
whitespace: "LF_AND_ASCII_SPACE"
hyphenation: "PRESERVE"
}
/**
 * @minItems 1
 */
pages: [{
page_number: number
canonical_page_text: string
canonical_page_text_sha256: string
code_point_length: number
}, ...({
page_number: number
canonical_page_text: string
canonical_page_text_sha256: string
code_point_length: number
})[]]
}
