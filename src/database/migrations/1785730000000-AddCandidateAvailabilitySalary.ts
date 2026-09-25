import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-CAND-05 — availability / mobility / salary expectation on the candidate
// profile (MAD range, maskable). Additive migration (ADR-0002): new nullable /
// defaulted columns only, no data rewrite. Re-introduces availability/mobility
// removed by 1785520000000 and adds the salary range + visibility flag the CDC
// asks for; the offers module stays removed.
export class AddCandidateAvailabilitySalary1785730000000
  implements MigrationInterface
{
  name = 'AddCandidateAvailabilitySalary1785730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "availability" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "mobility" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "salary_min" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "salary_max" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "salary_currency" character varying(3) NOT NULL DEFAULT 'MAD'`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "salary_visible" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "salary_visible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "salary_currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "salary_max"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "salary_min"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "mobility"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "availability"`,
    );
  }
}
