import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-ADM-02 — append-only version history for settings changes. Additive
// migration (ADR-0002): a new table only, existing tables untouched.
export class CreateSettingHistory1785780000000 implements MigrationInterface {
  name = 'CreateSettingHistory1785780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "setting_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "value" text NOT NULL,
        "description" character varying,
        "value_type" character varying NOT NULL DEFAULT 'string',
        "changed_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_setting_history" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_setting_history_key" ON "setting_history" ("key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_setting_history_key"`);
    await queryRunner.query(`DROP TABLE "setting_history"`);
  }
}
