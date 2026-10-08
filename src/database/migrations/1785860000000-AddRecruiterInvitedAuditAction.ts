import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the 'recruiter.invited' value to the audit action enum (used by
// RecruiterInvitationService). Additive; Postgres enum values cannot be
// dropped, so down() is intentionally a no-op.
export class AddRecruiterInvitedAuditAction1785860000000
  implements MigrationInterface
{
  name = 'AddRecruiterInvitedAuditAction1785860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'recruiter.invited'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres does not support removing a value from an enum type.
  }
}
