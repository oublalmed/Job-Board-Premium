import { MigrationInterface, QueryRunner } from 'typeorm';

// ENF-12 (CNDP/RGPD) — persist the privacy-policy consent timestamp captured
// at registration. Nullable: pre-existing accounts have no recorded consent.
export class AddUserConsentAt1785550000000 implements MigrationInterface {
  name = 'AddUserConsentAt1785550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "consent_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "consent_at"`);
  }
}
