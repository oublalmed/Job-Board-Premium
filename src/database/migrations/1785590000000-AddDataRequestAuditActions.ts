import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-ADM-03 — the data-request workflow logs two new AuditAction values
// (data_request.created, data_request.resolved). The audit_logs.action column
// is a Postgres enum, so on a migrations-only database (CI's migration-e2e
// job, ADR-0002) these values must be added to the type before any
// auditService.log() call can use them. Kept separate from the table
// migration so each ADD VALUE commits on its own (the value is only used at
// runtime, never inside a migration).
export class AddDataRequestAuditActions1785590000000 implements MigrationInterface {
  name = 'AddDataRequestAuditActions1785590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'data_request.created'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'data_request.resolved'`,
    );
  }

  // Postgres cannot drop a single enum value; a down migration would have to
  // rebuild the whole type. The forward-only ADD VALUE is safe and matches the
  // precedent set by FixAuditLogsActionEnum / AddNewMessageNotificationType.
  public async down(): Promise<void> {
    // no-op — see note above.
  }
}
