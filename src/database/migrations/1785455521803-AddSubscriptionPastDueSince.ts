import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriptionPastDueSince1785455521803 implements MigrationInterface {
    name = 'AddSubscriptionPastDueSince1785455521803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD "past_due_since" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "past_due_since"`);
    }

}
