import { MigrationInterface, QueryRunner } from 'typeorm';

// §5.3 subject-integrity layer (EF-EVAL / anti-cheat) — records the test
// version served for each attempt. Additive migration (ADR-0002): one nullable
// column on assessments, no data rewrite.
export class AddAssignedTestVersion1785740000000 implements MigrationInterface {
  name = 'AddAssignedTestVersion1785740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD "assigned_test_version" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assessments" DROP COLUMN "assigned_test_version"`,
    );
  }
}
