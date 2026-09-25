import { MigrationInterface, QueryRunner } from 'typeorm';

// ENF-01 — index the CVthèque hot read path. Every candidate search gates on
// `indexed_in_cvtheque = true AND visibility IN (...)` before any other
// filter (see SearchService); without this composite index that predicate is
// a sequential scan on the busiest table.
export class AddCandidateProfileSearchIndex1785540000000 implements MigrationInterface {
  name = 'AddCandidateProfileSearchIndex1785540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_candidate_profiles_indexed_visibility" ON "candidate_profiles" ("indexed_in_cvtheque", "visibility")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_candidate_profiles_indexed_visibility"`,
    );
  }
}
