import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-SRCH-04 — add the 'saved_search_alert' value to notifications_type_enum so
// the saved-search alert sweep can emit a dedicated in-app notification.
// Postgres cannot remove an enum value, so down() is a no-op (the extra value
// is harmless). Kept separate from the table migration so the ADD VALUE
// commits on its own — same precedent as AddNewMessageNotificationType.
export class AddSavedSearchAlertNotificationType1785630000000 implements MigrationInterface {
  name = 'AddSavedSearchAlertNotificationType1785630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'saved_search_alert'`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally irreversible: Postgres has no DROP VALUE for enums, and
    // leaving an unused value in place is safe.
  }
}
