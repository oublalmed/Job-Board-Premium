import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-EVAL-02 / §5.3 — first-party behavioural anti-cheat signals recorded from
// the secure-exam client: cumulative tab-switch and window-blur counts, plus a
// review flag raised when they cross the configured threshold. Additive
// migration (ADR-0002): new defaulted columns on assessments, no data rewrite.
export class AddAssessmentProctoringColumns1785720000000
  implements MigrationInterface
{
  name = 'AddAssessmentProctoringColumns1785720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD "tab_switch_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD "window_blur_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD "proctoring_flagged" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assessments" DROP COLUMN "proctoring_flagged"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" DROP COLUMN "window_blur_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" DROP COLUMN "tab_switch_count"`,
    );
  }
}
