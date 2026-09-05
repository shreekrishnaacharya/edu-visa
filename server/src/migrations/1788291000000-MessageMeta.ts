import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageMeta1788291000000 implements MigrationInterface {
  name = 'MessageMeta1788291000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "message" ADD COLUMN "meta" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "meta"`);
  }
}
