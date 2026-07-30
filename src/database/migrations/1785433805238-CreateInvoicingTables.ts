import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInvoicingTables1785433805238 implements MigrationInterface {
    name = 'CreateInvoicingTables1785433805238'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "invoice_sequences" ("year" integer NOT NULL, "last_number" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_18c1dc96dfddbc72f731a01e0fd" PRIMARY KEY ("year"))`);
        await queryRunner.query(`CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscription_id" uuid NOT NULL, "company_id" uuid NOT NULL, "invoice_number" character varying NOT NULL, "amount_ht" integer NOT NULL, "vat_rate" integer NOT NULL, "vat_amount" integer NOT NULL, "amount_ttc" integer NOT NULL, "currency" character varying NOT NULL DEFAULT 'MAD', "company_ice" character varying NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL, "pdf_storage_key" character varying NOT NULL, "stripe_invoice_id" character varying NOT NULL, CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invoices_stripe_invoice_id" ON "invoices"  ("stripe_invoice_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_invoices_invoice_number" ON "invoices"  ("invoice_number") `);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_5152c0aa0f851d9b95972b442e0" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_42385e42f092f26bd38df549717" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_42385e42f092f26bd38df549717"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_5152c0aa0f851d9b95972b442e0"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_invoices_invoice_number"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_invoices_stripe_invoice_id"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
        await queryRunner.query(`DROP TABLE "invoice_sequences"`);
    }

}
