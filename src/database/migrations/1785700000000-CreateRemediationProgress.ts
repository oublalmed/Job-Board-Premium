import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-CAND-09 — remediation progress tracking. Additive migration (ADR-0002):
// a new table only, no change to existing tables. One row per
// (candidate, resource_url); the unique constraint makes "mark completed"
// idempotent at the database level.
export class CreateRemediationProgress1785700000000
  implements MigrationInterface
{
  name = 'CreateRemediationProgress1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "remediation_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "candidate_id" uuid NOT NULL,
        "resource_url" character varying(2048) NOT NULL,
        "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_remediation_progress" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_remediation_progress_candidate_resource" UNIQUE ("candidate_id", "resource_url")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_remediation_progress_candidate" ON "remediation_progress" ("candidate_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_remediation_progress_candidate"`,
    );
    await queryRunner.query(`DROP TABLE "remediation_progress"`);
  }
}
