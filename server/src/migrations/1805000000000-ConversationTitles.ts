import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives a conversation a name and makes "most recently used" orderable, so the
 * AI consultant can hold several threads per student instead of one.
 *
 * `conversation` already supported many rows per student — the single-thread
 * behaviour came from the API only ever returning the newest one, so every
 * question a counsellor asked landed in the same undifferentiated thread with
 * no way to start a fresh one or go back to an earlier one.
 *
 * `title` is nullable: it is filled from the first user message when a thread
 * gets one, and existing threads are backfilled the same way below so they
 * appear in the list with a recognisable name rather than blank.
 *
 * `last_message_at` exists because `updated_at` is an @UpdateDateColumn on the
 * conversation row, and messages are inserted against `message` — so it does
 * not move when a thread is actually used, and sorting by it would put an
 * abandoned thread above an active one.
 *
 * Hand-written per this repo's established migration pattern.
 */
export class ConversationTitles1805000000000 implements MigrationInterface {
  name = 'ConversationTitles1805000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation" ADD COLUMN "title" character varying`);
    await queryRunner.query(`ALTER TABLE "conversation" ADD COLUMN "last_message_at" TIMESTAMP WITH TIME ZONE`);

    // Backfill: name each existing thread after its first question, and set
    // activity from its newest message so the list sorts sensibly on day one.
    await queryRunner.query(`
      UPDATE "conversation" c
         SET "title" = sub.title
        FROM (
          SELECT DISTINCT ON (m.conversation_id)
                 m.conversation_id,
                 left(regexp_replace(m.body, '\\s+', ' ', 'g'), 80) AS title
            FROM "message" m
           WHERE m.role = 'user'
           ORDER BY m.conversation_id, m.created_at ASC
        ) sub
       WHERE sub.conversation_id = c.id AND c."title" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "conversation" c
         SET "last_message_at" = sub.last_at
        FROM (
          SELECT conversation_id, max(created_at) AS last_at FROM "message" GROUP BY conversation_id
        ) sub
       WHERE sub.conversation_id = c.id
    `);
    // A thread with no messages at all still needs to sort somewhere.
    await queryRunner.query(
      `UPDATE "conversation" SET "last_message_at" = "created_at" WHERE "last_message_at" IS NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_student_activity" ON "conversation" ("student_id", "last_message_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_conversation_student_activity"`);
    await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "last_message_at"`);
    await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "title"`);
  }
}
