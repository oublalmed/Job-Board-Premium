import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-MSG-05 — abuse reports flagged by conversation participants; a
// moderation-queue table consumed later by admin (EF-ADM-01).
export class CreateMessageReports1785570000000 implements MigrationInterface {
  name = 'CreateMessageReports1785570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."message_reports_status_enum" AS ENUM('open', 'reviewed', 'dismissed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "message_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "reporter_user_id" uuid NOT NULL,
        "reason" text NOT NULL,
        "status" "public"."message_reports_status_enum" NOT NULL DEFAULT 'open',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_message_reports" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_reports_conversation_id" ON "message_reports" ("conversation_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_reports" ADD CONSTRAINT "FK_message_reports_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_reports" DROP CONSTRAINT "FK_message_reports_conversation"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_message_reports_conversation_id"`,
    );
    await queryRunner.query(`DROP TABLE "message_reports"`);
    await queryRunner.query(`DROP TYPE "public"."message_reports_status_enum"`);
  }
}
