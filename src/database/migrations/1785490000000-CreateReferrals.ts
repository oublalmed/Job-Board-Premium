import { MigrationInterface, QueryRunner } from 'typeorm';

// Lot 7 (EF-GROW-02) — referral links + conversion tracking.
export class CreateReferrals1785490000000 implements MigrationInterface {
  name = 'CreateReferrals1785490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."referral_conversions_status_enum" AS ENUM('signed_up', 'converted')`,
    );
    await queryRunner.query(
      `CREATE TABLE "referrals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referrer_user_id" uuid NOT NULL, "code" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_referrals_referrer_user_id" UNIQUE ("referrer_user_id"), CONSTRAINT "UQ_referrals_code" UNIQUE ("code"), CONSTRAINT "PK_referrals_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "referral_conversions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "referral_id" uuid NOT NULL, "referee_user_id" uuid NOT NULL, "status" "public"."referral_conversions_status_enum" NOT NULL DEFAULT 'signed_up', "converted_at" TIMESTAMP WITH TIME ZONE, "signed_up_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_referral_conversions_referee_user_id" UNIQUE ("referee_user_id"), CONSTRAINT "PK_referral_conversions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "referrals" ADD CONSTRAINT "FK_referrals_referrer_user_id" FOREIGN KEY ("referrer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "referral_conversions" ADD CONSTRAINT "FK_referral_conversions_referral_id" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "referral_conversions" ADD CONSTRAINT "FK_referral_conversions_referee_user_id" FOREIGN KEY ("referee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "referral_conversions" DROP CONSTRAINT "FK_referral_conversions_referee_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "referral_conversions" DROP CONSTRAINT "FK_referral_conversions_referral_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "referrals" DROP CONSTRAINT "FK_referrals_referrer_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "referral_conversions"`);
    await queryRunner.query(`DROP TABLE "referrals"`);
    await queryRunner.query(
      `DROP TYPE "public"."referral_conversions_status_enum"`,
    );
  }
}
