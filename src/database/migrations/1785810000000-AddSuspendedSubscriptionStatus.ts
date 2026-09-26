import { MigrationInterface, QueryRunner } from 'typeorm';

// Admin subscription management — add the 'suspended' value to
// subscriptions_status_enum so an admin can place an unpaid (PAST_DUE)
// company on hold. A suspended subscription is denied by
// SubscriptionGuardService (its switch default returns false), revoking
// CVthèque access until an admin reactivates it. Postgres cannot remove an
// enum value, so down() is a no-op (the extra value is harmless and unused
// once no row references it).
export class AddSuspendedSubscriptionStatus1785810000000
  implements MigrationInterface
{
  name = 'AddSuspendedSubscriptionStatus1785810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."subscriptions_status_enum" ADD VALUE IF NOT EXISTS 'suspended'`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally irreversible: Postgres has no DROP VALUE for enums, and
    // leaving an unused value in place is safe (ADR-0002 — additive only).
  }
}
