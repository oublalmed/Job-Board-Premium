import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-MSG-04 — interview scheduling. Additive migration (ADR-0002): a new table
// only, no change to existing tables. One conversation can carry several
// interview proposals over time; the row is deleted with its conversation.
export class CreateInterviews1785770000000 implements MigrationInterface {
  name = 'CreateInterviews1785770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."interviews_status_enum" AS ENUM('proposed', 'accepted', 'declined', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."interviews_mode_enum" AS ENUM('onsite', 'video', 'phone')`,
    );
    // proposed_by_role reuses the same value domain as messages.sender_role.
    await queryRunner.query(
      `CREATE TYPE "public"."interviews_proposed_by_role_enum" AS ENUM('candidate', 'recruiter')`,
    );
    await queryRunner.query(
      `CREATE TABLE "interviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "proposed_by_id" uuid NOT NULL,
        "proposed_by_role" "public"."interviews_proposed_by_role_enum" NOT NULL,
        "status" "public"."interviews_status_enum" NOT NULL DEFAULT 'proposed',
        "mode" "public"."interviews_mode_enum" NOT NULL,
        "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "duration_minutes" integer NOT NULL DEFAULT 60,
        "location" character varying(500),
        "note" text,
        "responded_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_interviews" PRIMARY KEY ("id"),
        CONSTRAINT "FK_interviews_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_interviews_conversation" ON "interviews" ("conversation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_interviews_conversation"`,
    );
    await queryRunner.query(`DROP TABLE "interviews"`);
    await queryRunner.query(
      `DROP TYPE "public"."interviews_proposed_by_role_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."interviews_mode_enum"`);
    await queryRunner.query(`DROP TYPE "public"."interviews_status_enum"`);
  }
}
