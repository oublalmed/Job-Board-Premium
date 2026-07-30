import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMessagingTables1785420071914 implements MigrationInterface {
    name = 'CreateMessagingTables1785420071914'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."conversations_status_enum" AS ENUM('open', 'closed')`);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "candidate_id" uuid NOT NULL, "recruiter_id" character varying NOT NULL, "company_id" uuid NOT NULL, "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'open', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0db3c001a4353842253d4452ada" UNIQUE ("candidate_id", "company_id"), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."messages_sender_role_enum" AS ENUM('candidate', 'recruiter')`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "sender_id" character varying NOT NULL, "sender_role" "public"."messages_sender_role_enum" NOT NULL, "body" text NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_7393bc31d1d9eb7e0f93f8cfce9" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_862ddf00e602bfc08a970f55ae0" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_862ddf00e602bfc08a970f55ae0"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_7393bc31d1d9eb7e0f93f8cfce9"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."messages_sender_role_enum"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
    }

}
