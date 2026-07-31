import { MigrationInterface, QueryRunner } from "typeorm";

// Lot 6D (commits 2 and 4) added SUBSCRIPTION_PAST_DUE and
// SUBSCRIPTION_PLAN_CHANGED to the AuditAction TypeScript enum but never
// generated a migration for the corresponding Postgres enum type —
// discovered while generating Lot 7's CreateNotifications migration
// (migration:generate surfaced the drift). On a migrations-only database
// (CI's migration-e2e job, ADR-0002), calling
// auditService.log({ action: AuditAction.SUBSCRIPTION_PAST_DUE, ... }) or
// SUBSCRIPTION_PLAN_CHANGED would fail with an invalid-enum-value error —
// this fixes the gap on its own, before Lot 7's own schema changes.
export class FixAuditLogsActionEnum1785463900000 implements MigrationInterface {
    name = 'FixAuditLogsActionEnum1785463900000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE 'subscription.past_due'`);
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE 'subscription.plan_changed'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_action_enum_old" AS ENUM('user.registered', 'user.login', 'user.logout', 'user.email_verified', 'user.password_changed', 'user.roles_changed', 'user.deleted', 'user.data_exported', 'profile.updated', 'document.uploaded', 'document.deleted', 'assessment.started', 'assessment.completed', 'assessment.incident', 'assessment.resumed', 'score.calculated', 'company.created', 'recruiter.added', 'recruiter.removed', 'job_offer.created', 'job_offer.moderated', 'job_offer.closed', 'shortlist_entry.added', 'shortlist_entry.removed', 'subscription.created', 'subscription.cancelled', 'payment.received', 'payment.failed', 'settings.changed', 'moderation.action')`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "public"."audit_logs_action_enum_old" USING "action"::"text"::"public"."audit_logs_action_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_action_enum_old" RENAME TO "audit_logs_action_enum"`);
    }

}
