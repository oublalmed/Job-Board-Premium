import { MigrationInterface, QueryRunner } from 'typeorm';

// ENF-06 — persistence for TOTP MFA. `mfa_secret` stores the base32 secret
// encrypted at rest (AES-256-GCM); `mfa_backup_codes` stores argon2 hashes of
// one-time backup codes. `refresh_tokens.mfa_authenticated` carries the
// session's step-up state across token rotation.
export class AddMfaColumns1785530000000 implements MigrationInterface {
  name = 'AddMfaColumns1785530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "mfa_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "mfa_secret" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "mfa_backup_codes" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD "mfa_authenticated" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN "mfa_authenticated"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "mfa_backup_codes"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfa_secret"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfa_enabled"`);
  }
}
