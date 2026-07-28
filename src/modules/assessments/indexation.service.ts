import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { Score, PlagiarismVerdict } from './entities/score.entity.js';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { SettingsService } from '../settings/settings.service.js';

const DEFAULT_INDEXATION_SCORE_MIN = 40;
const DEFAULT_INDEXATION_PERCENTILE_MIN = 30;
const DEFAULT_FEATURING_PERCENTILE_MIN = 75;
const DEFAULT_COMPLETENESS_THRESHOLD = 70;

@Injectable()
export class IndexationService {
  private readonly logger = new Logger(IndexationService.name);

  constructor(
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    private readonly settingsService: SettingsService,
  ) {}

  async applyThresholds(candidateId: string): Promise<void> {
    const profile = await this.profileRepo.findOne({
      where: { userId: candidateId },
    });

    if (!profile) {
      this.logger.debug(`No profile found for candidate ${candidateId}`);
      return;
    }

    const assessments = await this.assessmentRepo.find({
      where: { candidateId, status: AssessmentStatus.COMPLETED },
    });

    const assessmentIds = assessments.map((a) => a.id);

    let validScores: Score[] = [];
    if (assessmentIds.length > 0) {
      const allScores = await this.scoreRepo.find({
        where: assessmentIds.map((id) => ({ assessmentId: id })),
      });

      const now = new Date();
      validScores = allScores.filter(
        (s) =>
          s.plagiarismVerdict !== PlagiarismVerdict.CONFIRMED &&
          new Date(s.expiresAt) > now,
      );
    }

    const [
      indexationScoreMin,
      indexationPercentileMin,
      featuringPercentileMin,
      completenessThreshold,
    ] = await Promise.all([
      this.settingsService
        .getNumber('indexation_score_min')
        .then((v) => v ?? DEFAULT_INDEXATION_SCORE_MIN),
      this.settingsService
        .getNumber('indexation_percentile_min')
        .then((v) => v ?? DEFAULT_INDEXATION_PERCENTILE_MIN),
      this.settingsService
        .getNumber('featuring_percentile_min')
        .then((v) => v ?? DEFAULT_FEATURING_PERCENTILE_MIN),
      this.settingsService
        .getNumber('completeness_threshold_publishable')
        .then((v) => v ?? DEFAULT_COMPLETENESS_THRESHOLD),
    ]);

    const isCompleteEnough =
      Number(profile.completeness) >= completenessThreshold;

    let scoreThresholdMet = false;
    let shouldFeature = false;

    for (const score of validScores) {
      const value = Number(score.value);
      const percentile =
        score.percentile !== null ? Number(score.percentile) : null;

      if (
        value >= indexationScoreMin ||
        (percentile !== null && percentile >= indexationPercentileMin)
      ) {
        scoreThresholdMet = true;
      }

      if (percentile !== null && percentile >= featuringPercentileMin) {
        shouldFeature = true;
      }
    }

    profile.indexedInCvtheque = isCompleteEnough && scoreThresholdMet;
    profile.featured = profile.indexedInCvtheque && shouldFeature;

    await this.profileRepo.save(profile);
  }
}
