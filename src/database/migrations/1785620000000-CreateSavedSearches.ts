import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-SRCH-04 — a recruiter's reusable CVthèque queries. `criteria` stores the
// search filter DTO as JSONB so a saved search re-applies exactly; when
// `alert_enabled`, the daily alert sweep notifies the owner about newly
// indexed matching profiles and advances `last_notified_at`.
export class CreateSavedSearches1785620000000 implements MigrationInterface {
  name = 'CreateSavedSearches1785620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "saved_searches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "criteria" jsonb NOT NULL,
        "alert_enabled" boolean NOT NULL DEFAULT false,
        "last_notified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_searches" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_searches_owner_user_id" ON "saved_searches" ("owner_user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_searches" ADD CONSTRAINT "FK_saved_searches_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_searches" DROP CONSTRAINT "FK_saved_searches_owner"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_saved_searches_owner_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "saved_searches"`);
  }
}
