import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCandidateProfileViews1785470396917 implements MigrationInterface {
    name = 'CreateCandidateProfileViews1785470396917'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "candidate_profile_views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recruiter_id" uuid NOT NULL, "candidate_profile_id" uuid NOT NULL, "company_id" uuid NOT NULL, "viewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d9936a7f3c8fbe06661414ea020" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "profile_view_cooldowns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recruiter_id" uuid NOT NULL, "candidate_profile_id" uuid NOT NULL, "last_notified_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_profile_view_cooldowns_recruiter_candidate" UNIQUE ("recruiter_id", "candidate_profile_id"), CONSTRAINT "PK_798f07bca7cb133c91c0815a632" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5edf42851f2e94358a93e7f0a1" ON "profile_view_cooldowns"  ("recruiter_id") `);
        await queryRunner.query(`ALTER TABLE "candidate_profile_views" ADD CONSTRAINT "FK_75ca56632ef0c301677c20eafc2" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "candidate_profile_views" ADD CONSTRAINT "FK_094754897b4ed186ef8abf18e99" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "candidate_profile_views" ADD CONSTRAINT "FK_77486700a1e7dff4988f72ee922" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "profile_view_cooldowns" ADD CONSTRAINT "FK_5edf42851f2e94358a93e7f0a16" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "profile_view_cooldowns" ADD CONSTRAINT "FK_ccdc7f93afd6d2e418a35664723" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profile_view_cooldowns" DROP CONSTRAINT "FK_ccdc7f93afd6d2e418a35664723"`);
        await queryRunner.query(`ALTER TABLE "profile_view_cooldowns" DROP CONSTRAINT "FK_5edf42851f2e94358a93e7f0a16"`);
        await queryRunner.query(`ALTER TABLE "candidate_profile_views" DROP CONSTRAINT "FK_77486700a1e7dff4988f72ee922"`);
        await queryRunner.query(`ALTER TABLE "candidate_profile_views" DROP CONSTRAINT "FK_094754897b4ed186ef8abf18e99"`);
        await queryRunner.query(`ALTER TABLE "candidate_profile_views" DROP CONSTRAINT "FK_75ca56632ef0c301677c20eafc2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5edf42851f2e94358a93e7f0a1"`);
        await queryRunner.query(`DROP TABLE "profile_view_cooldowns"`);
        await queryRunner.query(`DROP TABLE "candidate_profile_views"`);
    }

}
