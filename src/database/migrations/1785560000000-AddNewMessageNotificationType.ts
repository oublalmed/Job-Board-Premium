import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-MSG-02 — add the 'new_message' value to notifications_type_enum so a new
// message can create a dedicated in-app notification. Postgres cannot remove
// an enum value, so down() is a no-op (the extra value is harmless).
export class AddNewMessageNotificationType1785560000000 implements MigrationInterface {
  name = 'AddNewMessageNotificationType1785560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'new_message'`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally irreversible: Postgres has no DROP VALUE for enums, and
    // leaving an unused value in place is safe.
  }
}
