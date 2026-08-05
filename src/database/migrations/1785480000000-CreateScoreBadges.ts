import { MigrationInterface, QueryRunner } from 'typeorm';

// Lot 7 (EF-GROW-01) — shareable, opt-in public score badge.
export class CreateScoreBadges1785480000000 implements MigrationInterface {
  name = 'CreateScoreBadges1785480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "score_badges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "score_id" uuid NOT NULL, "token" uuid NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "display_name" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_score_badges_user_id" UNIQUE ("user_id"), CONSTRAINT "UQ_score_badges_token" UNIQUE ("token"), CONSTRAINT "PK_score_badges_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "score_badges" ADD CONSTRAINT "FK_score_badges_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "score_badges" ADD CONSTRAINT "FK_score_badges_score_id" FOREIGN KEY ("score_id") REFERENCES "scores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "score_badges" DROP CONSTRAINT "FK_score_badges_score_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "score_badges" DROP CONSTRAINT "FK_score_badges_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "score_badges"`);
  }
}
