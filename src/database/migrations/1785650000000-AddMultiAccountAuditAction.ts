import { MigrationInterface, QueryRunner } from 'typeorm';

// §5.3 anti-cheat — the multi-account detection logs a new AuditAction value
// (assessment.multi_account_flagged). The audit_logs.action column is a
// Postgres enum, so on a migrations-only database (CI's migration-e2e job,
// ADR-0002) the value must be added to the type before any auditService.log()
// call can use it. Separate migration so the ADD VALUE commits on its own.
export class AddMultiAccountAuditAction1785650000000 implements MigrationInterface {
  name = 'AddMultiAccountAuditAction1785650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'assessment.multi_account_flagged'`,
    );
  }

  // Postgres cannot drop a single enum value; forward-only ADD VALUE, matching
  // the precedent set by the other enum-extension migrations.
  public async down(): Promise<void> {
    // no-op — see note above.
  }
}
