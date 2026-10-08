import { MigrationInterface, QueryRunner } from 'typeorm';

// Recruiter invitations — a company_admin invites a teammate by email to join
// their company as a recruiter. Additive migration (ADR-0002): a new table
// only. The raw token is emailed; only its SHA-256 hash is stored here.
export class CreateRecruiterInvitations1785850000000
  implements MigrationInterface
{
  name = 'CreateRecruiterInvitations1785850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "recruiter_invitations_status_enum" AS ENUM ('pending', 'accepted', 'revoked')`,
    );
    await queryRunner.query(
      `CREATE TABLE "recruiter_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "token_hash" character varying NOT NULL,
        "position" character varying,
        "status" "recruiter_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "invited_by_id" uuid,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recruiter_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recruiter_invitations_company" FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_recruiter_invitations_invited_by" FOREIGN KEY ("invited_by_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recruiter_invitations_email" ON "recruiter_invitations" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recruiter_invitations_token_hash" ON "recruiter_invitations" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recruiter_invitations_company" ON "recruiter_invitations" ("company_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_recruiter_invitations_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_recruiter_invitations_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_recruiter_invitations_email"`,
    );
    await queryRunner.query(`DROP TABLE "recruiter_invitations"`);
    await queryRunner.query(
      `DROP TYPE "recruiter_invitations_status_enum"`,
    );
  }
}
