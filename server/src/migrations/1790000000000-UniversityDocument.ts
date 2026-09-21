import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Uploaded source documents per university — the upload -> vision-extract ->
 * save-extracted-text -> ingest-to-RAG pipeline (`university-document.service.ts`).
 * Hand-written to match this repo's established pattern for anything outside
 * plain `migration:generate` (see AdmissionFields/Knowledge migrations).
 */
export class UniversityDocument1790000000000 implements MigrationInterface {
  name = 'UniversityDocument1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "university_document" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "university_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "doc_type" character varying NOT NULL DEFAULT 'entry_requirement',
        "file" jsonb NOT NULL,
        "extracted_text" text,
        "extraction_status" character varying NOT NULL DEFAULT 'pending',
        "extraction_error" text,
        "doc_id" uuid,
        "last_ingested_at" TIMESTAMP WITH TIME ZONE,
        "uploaded_by" character varying NOT NULL DEFAULT '',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_university_document" PRIMARY KEY ("id"),
        CONSTRAINT "FK_university_document_university" FOREIGN KEY ("university_id") REFERENCES "university"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_university_document_university_id" ON "university_document" ("university_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "university_document"`);
  }
}
