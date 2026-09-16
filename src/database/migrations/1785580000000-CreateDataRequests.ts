import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-ADM-03 — CNDP/RGPD data-subject requests as an auditable, SLA-tracked
// admin queue. Replaces the previous fire-and-forget export/erasure with a
// persisted request whose `due_at` (filing + 30 days) makes the legal
// deadline visible and sortable.
export class CreateDataRequests1785580000000 implements MigrationInterface {
  name = 'CreateDataRequests1785580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."data_requests_type_enum" AS ENUM('access', 'portability', 'erasure', 'rectification', 'objection')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."data_requests_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "data_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "public"."data_requests_type_enum" NOT NULL,
        "status" "public"."data_requests_status_enum" NOT NULL DEFAULT 'pending',
        "message" text,
        "resolution_note" text,
        "handled_by_user_id" uuid,
        "due_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "resolved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_data_requests" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_data_requests_user_id" ON "data_requests" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_data_requests_status" ON "data_requests" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_data_requests_handled_by_user_id" ON "data_requests" ("handled_by_user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_requests" ADD CONSTRAINT "FK_data_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "data_requests" DROP CONSTRAINT "FK_data_requests_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_data_requests_handled_by_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_data_requests_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_data_requests_user_id"`);
    await queryRunner.query(`DROP TABLE "data_requests"`);
    await queryRunner.query(`DROP TYPE "public"."data_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."data_requests_type_enum"`);
  }
}
