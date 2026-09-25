import { MigrationInterface, QueryRunner } from 'typeorm';

// Desired contract type on candidate profiles (CDI/CDD/PFE/Freelance).
// Additive migration (ADR-0002): a new nullable column, no data change;
// existing rows keep NULL (unspecified).
export class AddContractTypeToCandidateProfile1785800000000
  implements MigrationInterface
{
  name = 'AddContractTypeToCandidateProfile1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."candidate_profiles_contract_type_enum" AS ENUM('CDI', 'CDD', 'PFE', 'Freelance')`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" ADD "contract_type" "public"."candidate_profiles_contract_type_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidate_profiles" DROP COLUMN "contract_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."candidate_profiles_contract_type_enum"`,
    );
  }
}
