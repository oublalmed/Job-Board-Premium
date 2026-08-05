import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoreBadge } from './entities/score-badge.entity.js';
import { Score } from '../assessments/entities/score.entity.js';
import { ScoreBadgeService } from './score-badge.service.js';
import { ScoreBadgeController } from './score-badge.controller.js';
import { PublicBadgeController } from './public-badge.controller.js';

// Lot 7 — Amorçage / croissance. Currently EF-GROW-01 (shareable score
// badge). EF-GROW-03 (recruiter trial) lives in billing, EF-GROW-04 (profile
// viewed) in notifications; EF-GROW-02 (referral) is the remaining Could item.
@Module({
  imports: [TypeOrmModule.forFeature([ScoreBadge, Score])],
  controllers: [ScoreBadgeController, PublicBadgeController],
  providers: [ScoreBadgeService],
})
export class GrowthModule {}
