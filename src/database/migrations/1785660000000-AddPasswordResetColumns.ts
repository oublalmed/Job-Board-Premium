import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-CAND-01 — password-reset flow. Stores a hashed reset token + expiry on
// the user. The token column holds a SHA-256 hash of the emailed token, never
// the raw value.
export class AddPasswordResetColumns1785660000000 implements MigrationInterface {
  name = 'AddPasswordResetColumns1785660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_token" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_reset_expires" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_password_reset_token" ON "users" ("password_reset_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_users_password_reset_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_expires"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_reset_token"`,
    );
  }
}
