import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchoolVerification1785473000000 implements MigrationInterface {
  name = 'CreateSchoolVerification1785473000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."documents_type_enum" ADD VALUE 'diploma'`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "school_verified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."school_verifications_status_enum" AS ENUM('pending', 'verified', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "school_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "candidate_profile_id" uuid NOT NULL, "document_id" uuid NOT NULL, "status" "public"."school_verifications_status_enum" NOT NULL DEFAULT 'pending', "ocr_extracted_text" text, "matched_school" character varying, "confidence" numeric(5,2), "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "review_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_school_verifications" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_school_verifications_candidate_profile_id" ON "school_verifications" ("candidate_profile_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_verifications" ADD CONSTRAINT "FK_school_verifications_candidate_profile" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_verifications" ADD CONSTRAINT "FK_school_verifications_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_verifications" ADD CONSTRAINT "FK_school_verifications_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "school_verifications" DROP CONSTRAINT "FK_school_verifications_reviewed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_verifications" DROP CONSTRAINT "FK_school_verifications_document"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_verifications" DROP CONSTRAINT "FK_school_verifications_candidate_profile"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_school_verifications_candidate_profile_id"`,
    );
    await queryRunner.query(`DROP TABLE "school_verifications"`);
    await queryRunner.query(
      `DROP TYPE "public"."school_verifications_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "school_verified"`,
    );
    // Postgres has no ALTER TYPE ... DROP VALUE — rebuilding the enum
    // without 'diploma' is the only way back.
    await queryRunner.query(
      `ALTER TYPE "public"."documents_type_enum" RENAME TO "documents_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."documents_type_enum" AS ENUM('cv', 'certification', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "type" TYPE "public"."documents_type_enum" USING "type"::text::"public"."documents_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."documents_type_enum_old"`);
  }
}
