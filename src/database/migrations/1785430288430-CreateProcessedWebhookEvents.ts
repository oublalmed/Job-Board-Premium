import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProcessedWebhookEvents1785430288430 implements MigrationInterface {
    name = 'CreateProcessedWebhookEvents1785430288430'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "processed_webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider_event_id" character varying NOT NULL, "provider" character varying NOT NULL, "event_type" character varying NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b7cfb14901e774dcacb60cf00c2" UNIQUE ("provider_event_id"), CONSTRAINT "PK_80f4f20ca1cace20dd6e3a714c1" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "processed_webhook_events"`);
    }

}
