import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conversational curation: a counsellor hands the AI a URL, a file or an
 * instruction, and it proposes entity updates with citations.
 *
 * Needed because roughly half the largest providers block automated scraping,
 * so the fallback for their requirements cannot be "type it in by hand". The
 * proposals are staged as ordinary `sync_change` rows against a `sync_run` of
 * kind `ai_curation`, so the existing accept/apply/audit path covers them.
 *
 * Hand-written per this repo's established migration pattern.
 */
export class CurationSessions1800000000000 implements MigrationInterface {
  name = 'CurationSessions1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "curation_session" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" text NOT NULL DEFAULT '',
        "entity_type" character varying,
        "entity_id" uuid,
        "sync_run_id" uuid,
        "status" character varying NOT NULL DEFAULT 'open',
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_curation_session" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_curation_session_entity" ON "curation_session" ("entity_type", "entity_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "curation_message" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "role" character varying NOT NULL,
        "content" text NOT NULL DEFAULT '',
        "attachments" jsonb NOT NULL DEFAULT '[]',
        "proposals" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_curation_message" PRIMARY KEY ("id"),
        CONSTRAINT "FK_curation_message_session" FOREIGN KEY ("session_id")
          REFERENCES "curation_session"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_curation_message_session" ON "curation_message" ("session_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "curation_message"`);
    await queryRunner.query(`DROP TABLE "curation_session"`);
  }
}
