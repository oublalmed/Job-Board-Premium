import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-CAND-07 — structured certifications on the candidate profile. Before this
// only an enum value existed with nowhere to persist the records. Indexed on
// profile_id, the column every read scopes by.
export class CreateCertifications1785610000000 implements MigrationInterface {
  name = 'CreateCertifications1785610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "certifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "profile_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "issuer" character varying NOT NULL,
        "issue_date" date NOT NULL,
        "expiry_date" date,
        "credential_url" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_certifications" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_certifications_profile_id" ON "certifications" ("profile_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "certifications" ADD CONSTRAINT "FK_certifications_profile" FOREIGN KEY ("profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "certifications" DROP CONSTRAINT "FK_certifications_profile"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_certifications_profile_id"`,
    );
    await queryRunner.query(`DROP TABLE "certifications"`);
  }
}
