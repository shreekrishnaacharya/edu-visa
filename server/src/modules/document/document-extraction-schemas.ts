/**
 * Vision-extraction prompts for student documents — same JSON-schema-in-the-
 * prompt idea as the university-document pipeline's transcription prompt,
 * but asking for structured fields instead of raw text, scoped to what this
 * domain model can actually use: each schema's keys map onto real columns
 * on `academic_record` / `language_test` / `sponsor` / `student`, not
 * free-floating fields. Extraction only fills `student_document.extracted_data`
 * — nothing here writes to those tables directly (see DocumentService.extract).
 */
export interface DocExtractionSchema {
  label: string;
  fields: string[];
  prompt: string;
}

function schema(label: string, fields: string[]): DocExtractionSchema {
  const shape = fields.map((f) => `  "${f}": ""`).join(',\n');
  return {
    label,
    fields,
    prompt: `Extract the following fields from this ${label.toLowerCase()} and return ONLY valid JSON, no markdown, no commentary:\n{\n${shape}\n}\nIf a field is not visible or not applicable, use an empty string.`,
  };
}

export const DOCUMENT_EXTRACTION_SCHEMAS: Record<string, DocExtractionSchema> = {
  passport: schema('Passport', ['full_name', 'passport_number', 'nationality', 'date_of_birth', 'expiry_date']),
  academic_transcript: schema('Academic transcript', ['institution', 'course', 'gpa_value', 'gpa_scale', 'start_year', 'end_year']),
  ielts_cert: schema('IELTS test report form', ['overall', 'listening', 'reading', 'writing', 'speaking', 'test_date']),
  pte_cert: schema('PTE score report', ['overall', 'listening', 'reading', 'writing', 'speaking', 'test_date']),
  toefl_cert: schema('TOEFL score report', ['overall', 'listening', 'reading', 'writing', 'speaking', 'test_date']),
  bank_statement: schema('Bank statement', ['bank_name', 'closing_balance', 'currency', 'statement_period']),
};

export type DocExtractionSchemaKey = keyof typeof DOCUMENT_EXTRACTION_SCHEMAS;
