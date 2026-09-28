import { MigrationInterface, QueryRunner } from 'typeorm';

// §2 — recruiter toggle for the anti-cheat option (only usable when the pack
// includes the ANTI_CHEAT feature). Additive migration (ADR-0002): a new
// nullable-with-default column, existing rows untouched.
export class AddAntiCheatEnabledToCompany1785830000000
  implements MigrationInterface
{
  name = 'AddAntiCheatEnabledToCompany1785830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ADD COLUMN "anti_cheat_enabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN "anti_cheat_enabled"`,
    );
  }
}
