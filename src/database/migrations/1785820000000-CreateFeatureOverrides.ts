import { MigrationInterface, QueryRunner } from 'typeorm';

// §12 — admin feature overrides. Additive migration (ADR-0002): a new table
// only; the plan → features matrix (entitlements.matrix.ts) is unchanged code,
// this just lets an admin force a single feature on/off for one company.
export class CreateFeatureOverrides1785820000000 implements MigrationInterface {
  name = 'CreateFeatureOverrides1785820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "feature_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "feature" character varying NOT NULL,
        "enabled" boolean NOT NULL,
        "actor_id" character varying,
        "note" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feature_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feature_overrides_company_feature" UNIQUE ("company_id", "feature"),
        CONSTRAINT "FK_feature_overrides_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feature_overrides_company" ON "feature_overrides" ("company_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_feature_overrides_company"`,
    );
    await queryRunner.query(`DROP TABLE "feature_overrides"`);
  }
}
