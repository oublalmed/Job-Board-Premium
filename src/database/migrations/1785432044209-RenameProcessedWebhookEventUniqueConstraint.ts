import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameProcessedWebhookEventUniqueConstraint1785432044209 implements MigrationInterface {
    name = 'RenameProcessedWebhookEventUniqueConstraint1785432044209'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "processed_webhook_events" DROP CONSTRAINT "UQ_b7cfb14901e774dcacb60cf00c2"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_processed_webhook_events_provider_event_id" ON "processed_webhook_events"  ("provider_event_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_processed_webhook_events_provider_event_id"`);
        await queryRunner.query(`ALTER TABLE "processed_webhook_events" ADD CONSTRAINT "UQ_b7cfb14901e774dcacb60cf00c2" UNIQUE ("provider_event_id")`);
    }

}
