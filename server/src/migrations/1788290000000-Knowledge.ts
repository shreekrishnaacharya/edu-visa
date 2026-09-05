import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RAG Tier 2 store (plan appendix A). Hand-written (not `migration:generate`)
 * because `embedding` is a pgvector `vector(1536)` column — TypeORM has no
 * native type for it; the entity maps it as an opaque string column and never
 * re-synchronizes this table (see DocChunk's class comment).
 */
export class Knowledge1788290000000 implements MigrationInterface {
  name = 'Knowledge1788290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE "doc" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_url" character varying NOT NULL,
        "title" character varying NOT NULL DEFAULT '',
        "doc_type" character varying NOT NULL,
        "country" character varying(2) NOT NULL DEFAULT 'AU',
        "institution" character varying,
        "publisher" character varying NOT NULL DEFAULT '',
        "effective_date" date,
        "review_by" date,
        "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doc" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_doc_country" ON "doc" ("country")`);

    await queryRunner.query(`
      CREATE TABLE "doc_chunk" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doc_id" uuid NOT NULL,
        "chunk_index" integer NOT NULL,
        "text" text NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "country" character varying(2) NOT NULL DEFAULT 'AU',
        "doc_type" character varying NOT NULL,
        "institution" character varying,
        "effective_date" date,
        "source_url" character varying NOT NULL,
        "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED,
        CONSTRAINT "PK_doc_chunk" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doc_chunk_doc" FOREIGN KEY ("doc_id") REFERENCES "doc"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_doc_chunk_country" ON "doc_chunk" ("country")`);
    await queryRunner.query(`CREATE INDEX "IDX_doc_chunk_doc_type" ON "doc_chunk" ("doc_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_doc_chunk_tsv" ON "doc_chunk" USING GIN ("tsv")`);
    // ivfflat needs rows to train lists on; fine to create empty (defaults to a
    // reasonable plan) since this corpus is small (tens to low hundreds of rows).
    await queryRunner.query(
      `CREATE INDEX "IDX_doc_chunk_embedding" ON "doc_chunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "doc_chunk"`);
    await queryRunner.query(`DROP TABLE "doc"`);
  }
}
