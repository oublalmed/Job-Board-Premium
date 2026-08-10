import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyProfileFields1785510000000
  implements MigrationInterface
{
  name = 'AddCompanyProfileFields1785510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."companies_size_enum" AS ENUM('1-10', '11-50', '51-200', '201-500', '500+')`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "logo" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "sector" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "size" "public"."companies_size_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "companies" ADD "description" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "size"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "sector"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "logo"`);
    await queryRunner.query(`DROP TYPE "public"."companies_size_enum"`);
  }
}
