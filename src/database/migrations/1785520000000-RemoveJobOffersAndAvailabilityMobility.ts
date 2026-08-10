import { MigrationInterface, QueryRunner } from 'typeorm';

// Section 3 — remove the OFFRES feature (job_offers) and the candidate
// availability/mobility fields.
export class RemoveJobOffersAndAvailabilityMobility1785520000000
  implements MigrationInterface
{
  name = 'RemoveJobOffersAndAvailabilityMobility1785520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "job_offers"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."job_offers_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN IF EXISTS "availability"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN IF EXISTS "mobility"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "mobility" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "availability" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_offers_status_enum" AS ENUM('pending_moderation', 'published', 'rejected', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "job_offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "company_id" uuid NOT NULL, "created_by" character varying NOT NULL, "title" character varying NOT NULL, "description" text, "specialty_id" uuid, "status" "public"."job_offers_status_enum" NOT NULL DEFAULT 'pending_moderation', "moderated_by" uuid, "moderated_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9a54d36bd6829979f945defdeb5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_offers" ADD CONSTRAINT "FK_22cb0ff42ddb232ccdee8273982" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
