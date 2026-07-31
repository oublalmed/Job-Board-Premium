import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrialCodes1785471410764 implements MigrationInterface {
    name = 'CreateTrialCodes1785471410764'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."trial_codes_plan_enum" AS ENUM('starter', 'growth', 'scale', 'enterprise')`);
        await queryRunner.query(`CREATE TYPE "public"."trial_codes_status_enum" AS ENUM('active', 'revoked')`);
        await queryRunner.query(`CREATE TABLE "trial_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "plan" "public"."trial_codes_plan_enum" NOT NULL, "trial_duration_days" integer NOT NULL, "max_uses" integer NOT NULL, "used_count" integer NOT NULL DEFAULT '0', "status" "public"."trial_codes_status_enum" NOT NULL DEFAULT 'active', "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_351f0de4a4764e1fe03ad3cb948" UNIQUE ("code"), CONSTRAINT "PK_9422e1f8d428ea15f517d1aba0d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "trial_code_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trial_code_id" uuid NOT NULL, "company_id" uuid NOT NULL, "redeemed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "converted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_86ced3adbb4e7fce45c4d73d12e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_trial_code_redemptions_company_id" ON "trial_code_redemptions"  ("company_id") `);
        await queryRunner.query(`ALTER TABLE "trial_code_redemptions" ADD CONSTRAINT "FK_8b3ce3c90926855abad49f3cc66" FOREIGN KEY ("trial_code_id") REFERENCES "trial_codes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trial_code_redemptions" ADD CONSTRAINT "FK_884aeaab84dee52e811f248f533" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trial_code_redemptions" DROP CONSTRAINT "FK_884aeaab84dee52e811f248f533"`);
        await queryRunner.query(`ALTER TABLE "trial_code_redemptions" DROP CONSTRAINT "FK_8b3ce3c90926855abad49f3cc66"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_trial_code_redemptions_company_id"`);
        await queryRunner.query(`DROP TABLE "trial_code_redemptions"`);
        await queryRunner.query(`DROP TABLE "trial_codes"`);
        await queryRunner.query(`DROP TYPE "public"."trial_codes_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."trial_codes_plan_enum"`);
    }

}
