import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-CAND-07 — structured projects on the candidate profile, mirroring
// CreateCertifications. Before this the CDC listed projects as a profile
// sub-entity with nowhere to persist the records. Indexed on profile_id, the
// column every read scopes by. Additive migration (ADR-0002): CREATE TABLE
// only, no change to existing tables.
export class CreateProjects1785680000000 implements MigrationInterface {
  name = 'CreateProjects1785680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "profile_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "url" character varying,
        "role" character varying,
        "start_date" date,
        "end_date" date,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_profile_id" ON "projects" ("profile_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_profile" FOREIGN KEY ("profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_profile"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_projects_profile_id"`);
    await queryRunner.query(`DROP TABLE "projects"`);
  }
}
