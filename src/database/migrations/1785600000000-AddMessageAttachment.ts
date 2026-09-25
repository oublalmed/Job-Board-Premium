import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-MSG-03 — document sharing in conversations. One optional attachment per
// message, stored as nullable metadata columns on `messages` (the binary
// itself lives in object storage). ADR-0002: schema changes ship as an
// explicit migration.
export class AddMessageAttachment1785600000000 implements MigrationInterface {
  name = 'AddMessageAttachment1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "attachment_storage_key" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "attachment_original_name" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "attachment_mime_type" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD "attachment_size" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN "attachment_size"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN "attachment_mime_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN "attachment_original_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN "attachment_storage_key"`,
    );
  }
}
