import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScoreDomainFeedback1785462656950 implements MigrationInterface {
    name = 'AddScoreDomainFeedback1785462656950'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scores" ADD "domain_feedback" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scores" DROP COLUMN "domain_feedback"`);
    }

}
