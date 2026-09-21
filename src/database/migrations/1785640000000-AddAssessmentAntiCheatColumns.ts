import { MigrationInterface, QueryRunner } from 'typeorm';

// §5.3 anti-cheat (multi-account layer) — capture the client IP and an opaque
// device fingerprint on each assessment, plus a review flag raised when the
// same device/IP was used by a different candidate inside the detection
// window. Indexes back the detection count query.
export class AddAssessmentAntiCheatColumns1785640000000 implements MigrationInterface {
  name = 'AddAssessmentAntiCheatColumns1785640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD "ip_address" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD "device_fingerprint" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD "multi_account_flagged" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assessments_ip_address" ON "assessments" ("ip_address")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assessments_device_fingerprint" ON "assessments" ("device_fingerprint")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_assessments_device_fingerprint"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_assessments_ip_address"`);
    await queryRunner.query(
      `ALTER TABLE "assessments" DROP COLUMN "multi_account_flagged"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" DROP COLUMN "device_fingerprint"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" DROP COLUMN "ip_address"`,
    );
  }
}
