import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriptionCancelAtPeriodEnd1785457482804 implements MigrationInterface {
    name = 'AddSubscriptionCancelAtPeriodEnd1785457482804'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD "cancel_at_period_end" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "cancel_at_period_end"`);
    }

}
