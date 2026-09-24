import { MigrationInterface, QueryRunner } from 'typeorm';

// §5.3 anti-cheat (behavioural-signals layer) — recording client-side
// proctoring signals raises a new AuditAction value
// (assessment.proctoring_flagged). audit_logs.action is a Postgres enum, so on
// a migrations-only database the value must be added before any
// auditService.log() uses it. Separate migration so the ADD VALUE commits on
// its own (mirrors AddMultiAccountAuditAction).
export class AddProctoringAuditAction1785710000000
  implements MigrationInterface
{
  name = 'AddProctoringAuditAction1785710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'assessment.proctoring_flagged'`,
    );
  }

  // Postgres cannot drop a single enum value; forward-only ADD VALUE.
  public async down(): Promise<void> {
    // no-op — see note above.
  }
}
