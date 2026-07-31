import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssessmentCooldownNotifiedAt1785465209819 implements MigrationInterface {
    name = 'AddAssessmentCooldownNotifiedAt1785465209819'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessments" ADD "cooldown_notified_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN "cooldown_notified_at"`);
    }

}
