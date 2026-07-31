import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { Score } from './entities/score.entity.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  INDEXATION_SCORE_MIN_KEY,
  INDEXATION_PERCENTILE_MIN_KEY,
  DEFAULT_INDEXATION_SCORE_MIN,
  DEFAULT_INDEXATION_PERCENTILE_MIN,
} from './indexation.service.js';
import {
  COOLDOWN_SETTINGS_KEY,
  DEFAULT_COOLDOWN_DAYS,
  computeCooldownEnd,
} from './cooldown.js';
import { resourcesForDomain, RemediationResource } from './remediation-resources.js';
import type { DomainFeedbackEntry } from '../../ports/scoring.port.js';

export interface RemediationFeedback {
  scoreValue: number;
  indexationThresholdMet: boolean;
  domainFeedback: DomainFeedbackEntry[];
  resources: RemediationResource[];
  reEligibleAt: string | null;
}

@Injectable()
export class RemediationService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    private readonly settingsService: SettingsService,
  ) {}

  // WHERE-scoped by (id, candidateId) in the same query, never a load then
  // a JS-side ownership check — a candidate can never even learn that
  // another candidate's assessment id exists (404, not 403).
  async getFeedback(
    candidateId: string,
    assessmentId: string,
  ): Promise<RemediationFeedback> {
    const assessment = await this.assessmentRepo.findOne({
      where: {
        id: assessmentId,
        candidateId,
        status: AssessmentStatus.COMPLETED,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const score = await this.scoreRepo.findOne({
      where: { assessmentId: assessment.id },
    });

    if (!score) {
      throw new NotFoundException('Score not found for this assessment');
    }

    const [scoreMin, percentileMin, cooldownDays] = await Promise.all([
      this.settingsService
        .getNumber(INDEXATION_SCORE_MIN_KEY)
        .then((v) => v ?? DEFAULT_INDEXATION_SCORE_MIN),
      this.settingsService
        .getNumber(INDEXATION_PERCENTILE_MIN_KEY)
        .then((v) => v ?? DEFAULT_INDEXATION_PERCENTILE_MIN),
      this.settingsService
        .getNumber(COOLDOWN_SETTINGS_KEY)
        .then((v) => v ?? DEFAULT_COOLDOWN_DAYS),
    ]);

    const value = Number(score.value);
    const percentile = score.percentile !== null ? Number(score.percentile) : null;
    const indexationThresholdMet =
      value >= scoreMin || (percentile !== null && percentile >= percentileMin);

    const domainFeedback = score.domainFeedback ?? [];
    const weakDomains = domainFeedback
      .filter((entry) => entry.level === 'weak')
      .map((entry) => entry.domain);

    const resources = weakDomains.flatMap((domain) => resourcesForDomain(domain));

    const reEligibleAt = assessment.completedAt
      ? computeCooldownEnd(assessment.completedAt, cooldownDays).toISOString()
      : null;

    return {
      scoreValue: value,
      indexationThresholdMet,
      domainFeedback,
      resources,
      reEligibleAt,
    };
  }
}
