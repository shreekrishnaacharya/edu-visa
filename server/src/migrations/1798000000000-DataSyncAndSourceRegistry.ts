import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data-sync subsystem: the known-source registry (`source_page`) plus the
 * run/staged-change tables that let a sync be reviewed and approved in the UI
 * instead of applied blind by a CLI script.
 *
 * `source_page` is both provenance (which page a fact was read off, so it can
 * be re-pulled when stale) and AI context (what kind of data a known-good URL
 * holds). `sync_change` records auto-applied changes too, so the set nobody
 * reviewed up front stays auditable afterwards.
 *
 * Hand-written per this repo's established migration pattern.
 */
export class DataSyncAndSourceRegistry1798000000000 implements MigrationInterface {
  name = 'DataSyncAndSourceRegistry1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "source_page" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "url" text NOT NULL,
        "domain" character varying NOT NULL,
        "trust_tier" character varying NOT NULL DEFAULT 'unverified',
        "data_kinds" text array NOT NULL DEFAULT '{}',
        "description" text NOT NULL DEFAULT '',
        "entity_type" character varying,
        "entity_id" uuid,
        "last_fetched_at" TIMESTAMP WITH TIME ZONE,
        "last_changed_at" TIMESTAMP WITH TIME ZONE,
        "content_hash" character varying,
        "http_status" integer,
        "fetch_status" character varying NOT NULL DEFAULT 'never_fetched',
        "robots_allowed" boolean NOT NULL DEFAULT true,
        "verified_by" uuid,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "notes" text NOT NULL DEFAULT '',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_source_page" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_source_page_url" UNIQUE ("url")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_source_page_entity" ON "source_page" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_source_page_last_fetched" ON "source_page" ("last_fetched_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "sync_run" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'queued',
        "params" jsonb NOT NULL DEFAULT '{}',
        "totals" jsonb NOT NULL DEFAULT '{}',
        "source_meta" jsonb NOT NULL DEFAULT '{}',
        "log" jsonb NOT NULL DEFAULT '[]',
        "error" text,
        "created_by" uuid,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "finished_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_run" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_sync_run_kind_status" ON "sync_run" ("kind", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_sync_run_created_at" ON "sync_run" ("created_at")`);

    await queryRunner.query(`
      CREATE TABLE "sync_change" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sync_run_id" uuid NOT NULL,
        "entity_type" character varying NOT NULL,
        "entity_id" uuid,
        "natural_key" character varying,
        "label" text NOT NULL DEFAULT '',
        "change_type" character varying NOT NULL,
        "field_diffs" jsonb NOT NULL DEFAULT '[]',
        "payload" jsonb NOT NULL DEFAULT '{}',
        "auto_applied" boolean NOT NULL DEFAULT false,
        "decision" character varying NOT NULL DEFAULT 'pending',
        "source_page_id" uuid,
        "confidence" real,
        "decided_by" uuid,
        "decided_at" TIMESTAMP WITH TIME ZONE,
        "apply_error" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_change" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sync_change_run" FOREIGN KEY ("sync_run_id")
          REFERENCES "sync_run"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_change_run_entity" ON "sync_change" ("sync_run_id", "entity_type", "change_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sync_change_run_decision" ON "sync_change" ("sync_run_id", "decision")`,
    );

    for (const table of ['university', 'course']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "last_fetched_at" TIMESTAMP WITH TIME ZONE`,
      );
      await queryRunner.query(`ALTER TABLE "${table}" ADD "content_hash" character varying`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['university', 'course']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "content_hash"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "last_fetched_at"`);
    }
    await queryRunner.query(`DROP TABLE "sync_change"`);
    await queryRunner.query(`DROP TABLE "sync_run"`);
    await queryRunner.query(`DROP TABLE "source_page"`);
  }
}
