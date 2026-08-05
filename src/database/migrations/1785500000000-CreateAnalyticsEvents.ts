import { MigrationInterface, QueryRunner } from 'typeorm';

// Lot 8 (EF-ADM-05) — amorçage funnel event store.
export class CreateAnalyticsEvents1785500000000 implements MigrationInterface {
  name = 'CreateAnalyticsEvents1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."analytics_events_type_enum" AS ENUM('signup', 'email_verified', 'test_started', 'score_obtained', 'recruiter_contact', 'subscription_created')`,
    );
    await queryRunner.query(
      `CREATE TABLE "analytics_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."analytics_events_type_enum" NOT NULL, "user_id" uuid, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_analytics_events_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_type" ON "analytics_events" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_created_at" ON "analytics_events" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_analytics_events_created_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_analytics_events_type"`);
    await queryRunner.query(`DROP TABLE "analytics_events"`);
    await queryRunner.query(`DROP TYPE "public"."analytics_events_type_enum"`);
  }
}
