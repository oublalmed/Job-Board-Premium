import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubscriptionsActiveUniqueIndex1785426763260 implements MigrationInterface {
    name = 'AddSubscriptionsActiveUniqueIndex1785426763260'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_subscriptions_company_active" ON "subscriptions"  ("company_id") WHERE status IN ('trial', 'active')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_subscriptions_company_active"`);
    }

}
