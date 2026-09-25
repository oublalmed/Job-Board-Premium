import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-EVAL-01 — "one active test per specialty" was a documented rule but never
// enforced. A partial unique index makes the database the source of truth:
// at most one row per specialty may have active = true (inactive/archived
// versions are unconstrained, so a specialty can keep its history).
export class UniqueActiveTestPerSpecialty1785670000000 implements MigrationInterface {
  name = 'UniqueActiveTestPerSpecialty1785670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tests_one_active_per_specialty" ON "tests" ("specialty_id") WHERE "active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_tests_one_active_per_specialty"`,
    );
  }
}
