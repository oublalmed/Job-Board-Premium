import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { Score } from './entities/score.entity.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  INDEXATION_SCORE_MIN_KEY,
  INDEXATION_PERCENTILE_MIN_KEY,
  FEATURING_PERCENTILE_MIN_KEY,
  DEFAULT_INDEXATION_SCORE_MIN,
  DEFAULT_INDEXATION_PERCENTILE_MIN,
  DEFAULT_FEATURING_PERCENTILE_MIN,
} from './indexation.service.js';
import {
  COOLDOWN_SETTINGS_KEY,
  DEFAULT_COOLDOWN_DAYS,
  computeCooldownEnd,
} from './cooldown.js';
import {
  resourcesForDomainWith,
  parseResourceOverride,
  REMEDIATION_RESOURCES_OVERRIDE_KEY,
  RemediationResource,
} from './remediation-resources.js';
import { RemediationProgressService } from './remediation-progress.service.js';
import type { DomainFeedbackEntry } from '../../ports/scoring.port.js';

// EF-CAND-09 — a resource plus whether the candidate has completed it.
export interface RemediationResourceProgress extends RemediationResource {
  completed: boolean;
}

export interface RemediationFeedback {
  scoreValue: number;
  technicalScore: number | null;
  psychotechnicalScore: number | null;
  indexationThresholdMet: boolean;
  domainFeedback: DomainFeedbackEntry[];
  resources: RemediationResourceProgress[];
  // EF-CAND-09 — completion progress across the recommended resources.
  completedCount: number;
  totalCount: number;
  // Barème §5.2 — the thresholds the candidate is measured against, surfaced so
  // the standing (indexed? highlighted?) is transparent rather than opaque.
  barème: {
    indexationScoreMin: number;
    indexationPercentileMin: number;
    highlightPercentileMin: number;
    highlightMet: boolean;
  };
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
    private readonly progressService: RemediationProgressService,
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

    const [scoreMin, percentileMin, highlightPercentileMin, cooldownDays] =
      await Promise.all([
        this.settingsService
          .getNumber(INDEXATION_SCORE_MIN_KEY)
          .then((v) => v ?? DEFAULT_INDEXATION_SCORE_MIN),
        this.settingsService
          .getNumber(INDEXATION_PERCENTILE_MIN_KEY)
          .then((v) => v ?? DEFAULT_INDEXATION_PERCENTILE_MIN),
        this.settingsService
          .getNumber(FEATURING_PERCENTILE_MIN_KEY)
          .then((v) => v ?? DEFAULT_FEATURING_PERCENTILE_MIN),
        this.settingsService
          .getNumber(COOLDOWN_SETTINGS_KEY)
          .then((v) => v ?? DEFAULT_COOLDOWN_DAYS),
      ]);

    const value = Number(score.value);
    const percentile = score.percentile !== null ? Number(score.percentile) : null;
    const indexationThresholdMet =
      value >= scoreMin || (percentile !== null && percentile >= percentileMin);
    const highlightMet =
      percentile !== null && percentile >= highlightPercentileMin;

    const domainFeedback = score.domainFeedback ?? [];
    const weakDomains = domainFeedback
      .filter((entry) => entry.level === 'weak')
      .map((entry) => entry.domain);

    // EF-REM-02 — honour an admin-configured resource override (settings),
    // falling back to the curated static table per weak domain.
    const override = parseResourceOverride(
      await this.settingsService.get(REMEDIATION_RESOURCES_OVERRIDE_KEY),
    );
    const rawResources = weakDomains.flatMap((domain) =>
      resourcesForDomainWith(domain, override),
    );
    // EF-CAND-09 — annotate each resource with the candidate's completion
    // state so the UI can render an actionable, trackable journey.
    const completed = await this.progressService.completedUrls(candidateId);
    const resources: RemediationResourceProgress[] = rawResources.map((r) => ({
      ...r,
      completed: completed.has(r.url),
    }));
    const completedCount = resources.filter((r) => r.completed).length;

    const reEligibleAt = assessment.completedAt
      ? computeCooldownEnd(assessment.completedAt, cooldownDays).toISOString()
      : null;

    return {
      scoreValue: value,
      technicalScore: score.technicalScore !== null ? Number(score.technicalScore) : null,
      psychotechnicalScore:
        score.psychotechnicalScore !== null ? Number(score.psychotechnicalScore) : null,
      indexationThresholdMet,
      domainFeedback,
      resources,
      completedCount,
      totalCount: resources.length,
      barème: {
        indexationScoreMin: scoreMin,
        indexationPercentileMin: percentileMin,
        highlightPercentileMin,
        highlightMet,
      },
      reEligibleAt,
    };
  }
}
