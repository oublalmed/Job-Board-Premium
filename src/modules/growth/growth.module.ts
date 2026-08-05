import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoreBadge } from './entities/score-badge.entity.js';
import { Referral } from './entities/referral.entity.js';
import { ReferralConversion } from './entities/referral-conversion.entity.js';
import { Score } from '../assessments/entities/score.entity.js';
import { ScoreBadgeService } from './score-badge.service.js';
import { ScoreBadgeController } from './score-badge.controller.js';
import { PublicBadgeController } from './public-badge.controller.js';
import { ReferralService } from './referral.service.js';
import { ReferralController } from './referral.controller.js';
import { PublicReferralController } from './public-referral.controller.js';

// Lot 7 — Amorçage / croissance. EF-GROW-01 (shareable score badge) and
// EF-GROW-02 (referral). EF-GROW-03 (recruiter trial) lives in billing,
// EF-GROW-04 (profile viewed) in notifications. ReferralService is exported
// so the auth flow can record signups/conversions.
@Module({
  imports: [
    TypeOrmModule.forFeature([ScoreBadge, Score, Referral, ReferralConversion]),
  ],
  controllers: [
    ScoreBadgeController,
    PublicBadgeController,
    ReferralController,
    PublicReferralController,
  ],
  providers: [ScoreBadgeService, ReferralService],
  exports: [ReferralService],
})
export class GrowthModule {}
