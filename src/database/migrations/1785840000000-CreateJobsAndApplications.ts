import { MigrationInterface, QueryRunner } from 'typeorm';

// §3 — job offers + applications (re-introduced). Additive migration
// (ADR-0002): new tables + enum types only, existing schema untouched.
export class CreateJobsAndApplications1785840000000
  implements MigrationInterface
{
  name = 'CreateJobsAndApplications1785840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."job_offers_status_enum" AS ENUM('draft', 'published', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_offers_contract_type_enum" AS ENUM('CDI', 'CDD', 'PFE', 'Freelance', 'Internship')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_offers_experience_level_enum" AS ENUM('junior', 'mid', 'senior', 'lead')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_applications_status_enum" AS ENUM('applied', 'under_review', 'shortlisted', 'interview', 'rejected', 'accepted')`,
    );

    await queryRunner.query(
      `CREATE TABLE "job_offers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "created_by" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "location" character varying,
        "contract_type" "public"."job_offers_contract_type_enum",
        "experience_level" "public"."job_offers_experience_level_enum",
        "skills" text,
        "status" "public"."job_offers_status_enum" NOT NULL DEFAULT 'draft',
        "published_at" TIMESTAMP WITH TIME ZONE,
        "deadline" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_offers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_job_offers_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_offers_company" ON "job_offers" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_offers_status" ON "job_offers" ("status")`,
    );

    await queryRunner.query(
      `CREATE TABLE "job_applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_offer_id" uuid NOT NULL,
        "candidate_id" uuid NOT NULL,
        "candidate_profile_id" uuid NOT NULL,
        "status" "public"."job_applications_status_enum" NOT NULL DEFAULT 'applied',
        "cover_letter" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_job_applications" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_job_applications_offer_candidate" UNIQUE ("job_offer_id", "candidate_id"),
        CONSTRAINT "FK_job_applications_offer" FOREIGN KEY ("job_offer_id")
          REFERENCES "job_offers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_job_applications_profile" FOREIGN KEY ("candidate_profile_id")
          REFERENCES "candidate_profiles"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_applications_offer" ON "job_applications" ("job_offer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "job_applications"`);
    await queryRunner.query(`DROP TABLE "job_offers"`);
    await queryRunner.query(
      `DROP TYPE "public"."job_applications_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."job_offers_experience_level_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."job_offers_contract_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."job_offers_status_enum"`);
  }
}
