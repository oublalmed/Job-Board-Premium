import { MigrationInterface, QueryRunner } from 'typeorm';

// EF-MSG-04 — add the interview notification values to notifications_type_enum
// so proposing/answering an interview slot can raise a dedicated in-app
// notification. Postgres cannot remove an enum value, so down() is a no-op.
export class AddInterviewNotificationTypes1785760000000 implements MigrationInterface {
  name = 'AddInterviewNotificationTypes1785760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'interview_proposed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'interview_updated'`,
    );
  }

  public async down(): Promise<void> {
    // Intentionally irreversible: Postgres has no DROP VALUE for enums, and
    // leaving unused values in place is safe.
  }
}
