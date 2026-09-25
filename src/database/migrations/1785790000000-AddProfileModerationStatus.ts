import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-ADM-01 — admin-owned moderation status on candidate profiles. Additive
// migration (ADR-0002): a new nullable-default column, no data change; existing
// rows default to 'active'.
export class AddProfileModerationStatus1785790000000
  implements MigrationInterface
{
  name = 'AddProfileModerationStatus1785790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."candidate_profiles_moderation_status_enum" AS ENUM('active', 'suspended')`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "moderation_status" "public"."candidate_profiles_moderation_status_enum" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_candidate_profiles_moderation_status" ON "candidate_profiles" ("moderation_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_candidate_profiles_moderation_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "moderation_status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."candidate_profiles_moderation_status_enum"`,
    );
  }
}
