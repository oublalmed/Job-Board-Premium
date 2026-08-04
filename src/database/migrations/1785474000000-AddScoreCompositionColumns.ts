import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScoreCompositionColumns1785474000000
  implements MigrationInterface
{
  name = 'AddScoreCompositionColumns1785474000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scores" ADD "technical_score" numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "scores" ADD "psychotechnical_score" numeric(5,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scores" DROP COLUMN "psychotechnical_score"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scores" DROP COLUMN "technical_score"`,
    );
  }
}
