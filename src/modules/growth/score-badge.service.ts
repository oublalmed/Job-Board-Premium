import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Score } from '../assessments/entities/score.entity.js';
import { ScoreBadge } from './entities/score-badge.entity.js';
import type { BadgeLevel, PublicBadgeDto } from './dto/public-badge.dto.js';
import type { ScoreBadgeStatusDto } from './dto/score-badge-status.dto.js';

@Injectable()
export class ScoreBadgeService {
  constructor(
    @InjectRepository(ScoreBadge)
    private readonly badgeRepo: Repository<ScoreBadge>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
  ) {}

  // Qualitative band derived from the composite score. Kept coarse on
  // purpose — the public badge shows a level, never a leaderboard position
  // or anything that could be reverse-engineered into answers.
  private levelFor(value: number): BadgeLevel {
    if (value >= 85) return 'expert';
    if (value >= 70) return 'advanced';
    if (value >= 50) return 'intermediate';
    return 'beginner';
  }

  // decimal columns come back from pg as strings — normalise to numbers.
  private toPublic(score: Score, displayName: string | null): PublicBadgeDto {
    const value = Number(score.value);
    return {
      scoreValue: value,
      percentile: score.percentile != null ? Number(score.percentile) : null,
      specialtyName: score.assessment?.test?.specialty?.name ?? '—',
      level: this.levelFor(value),
      issuedAt: score.createdAt.toISOString(),
      displayName,
    };
  }

  private async findBestScore(userId: string): Promise<Score | null> {
    return this.scoreRepo
      .createQueryBuilder('score')
      .innerJoin('score.assessment', 'a')
      .where('a.candidateId = :userId', { userId })
      .orderBy('score.value', 'DESC')
      .getOne();
  }

  private async loadScoreWithRelations(scoreId: string): Promise<Score | null> {
    return this.scoreRepo.findOne({
      where: { id: scoreId },
      relations: { assessment: { test: { specialty: true } } },
    });
  }

  async getStatus(userId: string): Promise<ScoreBadgeStatusDto> {
    const [badge, bestScore] = await Promise.all([
      this.badgeRepo.findOne({ where: { userId } }),
      this.findBestScore(userId),
    ]);

    if (!badge) {
      return {
        hasBadge: false,
        enabled: false,
        token: null,
        badge: null,
        hasScore: bestScore !== null,
      };
    }

    const score = await this.loadScoreWithRelations(badge.scoreId);
    return {
      hasBadge: true,
      enabled: badge.enabled,
      token: badge.token,
      badge: score ? this.toPublic(score, badge.displayName) : null,
      hasScore: bestScore !== null,
    };
  }

  async enable(
    userId: string,
    displayName?: string,
  ): Promise<ScoreBadgeStatusDto> {
    const best = await this.findBestScore(userId);
    if (!best) {
      throw new BadRequestException(
        'No score available to showcase — take an assessment first.',
      );
    }

    let badge = await this.badgeRepo.findOne({ where: { userId } });
    if (!badge) {
      badge = this.badgeRepo.create({
        userId,
        scoreId: best.id,
        token: uuidv4(),
        enabled: true,
        displayName: displayName?.trim() || null,
      });
    } else {
      // Refresh to the current best score each time it's (re-)enabled.
      badge.scoreId = best.id;
      badge.enabled = true;
      if (displayName !== undefined) {
        badge.displayName = displayName.trim() || null;
      }
    }
    await this.badgeRepo.save(badge);
    return this.getStatus(userId);
  }

  async disable(userId: string): Promise<ScoreBadgeStatusDto> {
    const badge = await this.badgeRepo.findOne({ where: { userId } });
    if (badge && badge.enabled) {
      badge.enabled = false;
      await this.badgeRepo.save(badge);
    }
    return this.getStatus(userId);
  }

  async getPublic(token: string): Promise<PublicBadgeDto> {
    const badge = await this.badgeRepo.findOne({
      where: { token, enabled: true },
    });
    if (!badge) {
      throw new NotFoundException('Badge not found');
    }
    const score = await this.loadScoreWithRelations(badge.scoreId);
    if (!score) {
      throw new NotFoundException('Badge not found');
    }
    return this.toPublic(score, badge.displayName);
  }
}
