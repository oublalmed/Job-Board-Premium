import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-CAND-04 — asynchronous accessibility verification of external profile
// links. Additive migration (ADR-0002): a new enum type + two nullable/defaulted
// columns on the existing profile_links table; no data rewrite. Existing rows
// default to 'pending' and get verified lazily the next time they are probed.
export class AddProfileLinkAccessibility1785690000000 implements MigrationInterface {
  name = 'AddProfileLinkAccessibility1785690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."profile_links_accessibility_status_enum" AS ENUM('pending', 'reachable', 'unreachable')`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_links" ADD "accessibility_status" "public"."profile_links_accessibility_status_enum" NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_links" ADD "checked_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_links" DROP COLUMN "checked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile_links" DROP COLUMN "accessibility_status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."profile_links_accessibility_status_enum"`,
    );
  }
}
