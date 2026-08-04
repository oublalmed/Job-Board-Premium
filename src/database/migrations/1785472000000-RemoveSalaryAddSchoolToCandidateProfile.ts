import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSalaryAddSchoolToCandidateProfile1785472000000 implements MigrationInterface {
  name = 'RemoveSalaryAddSchoolToCandidateProfile1785472000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "salary_min"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "salary_max"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "salary_visible"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "school" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "school"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "salary_visible" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "salary_max" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "salary_min" integer`,
    );
  }
}
