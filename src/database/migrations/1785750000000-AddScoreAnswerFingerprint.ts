import { MigrationInterface, QueryRunner } from 'typeorm';

// §5.3 plagiarism/collision layer — an opaque answer fingerprint per score,
// used to detect copies across different candidates. Additive migration
// (ADR-0002): one nullable column + a lookup index, no data rewrite.
export class AddScoreAnswerFingerprint1785750000000
  implements MigrationInterface
{
  name = 'AddScoreAnswerFingerprint1785750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scores" ADD "answer_fingerprint" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scores_answer_fingerprint" ON "scores" ("answer_fingerprint")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_scores_answer_fingerprint"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scores" DROP COLUMN "answer_fingerprint"`,
    );
  }
}
