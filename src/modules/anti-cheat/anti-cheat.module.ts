import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment } from '../assessments/entities/assessment.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { AntiCheatService } from './anti-cheat.service.js';
import { AntiCheatController } from './anti-cheat.controller.js';

// §2 — recruiter-facing anti-cheat, gated by the ANTI_CHEAT feature. The
// EntitlementService + FeatureGuard come from the global EntitlementsModule.
@Module({
  imports: [TypeOrmModule.forFeature([Assessment, CandidateProfile, Company])],
  controllers: [AntiCheatController],
  providers: [AntiCheatService],
})
export class AntiCheatModule {}
