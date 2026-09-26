import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { Score, PlagiarismVerdict } from './entities/score.entity.js';
import { Test as TestEntity } from './entities/test.entity.js';
import type {
  ScoringProvider,
  AssessmentResult,
} from '../../ports/scoring.port.js';
import { SCORING_PROVIDER } from '../../ports/scoring.port.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { IndexationService } from './indexation.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AnalyticsEventType } from '../analytics/entities/analytics-event.entity.js';

const DEFAULT_SCORE_VALIDITY_DAYS = 365;
const DEFAULT_BAREME_VERSION = '1.0';

// The pivot's évaluation composition — configurable like every other
// scoring weight in this codebase (completeness weights, indexation
// thresholds), not hardcoded, so it can be retuned without a redeploy.
export const TECHNIQUE_WEIGHT_KEY = 'score_technique_weight';
export const PSYCHOTECHNIQUE_WEIGHT_KEY = 'score_psychotechnique_weight';
export const DEFAULT_TECHNIQUE_WEIGHT = 60;
export const DEFAULT_PSYCHOTECHNIQUE_WEIGHT = 40;

const PLAGIARISM_MAP: Record<string, PlagiarismVerdict> = {
  clean: PlagiarismVerdict.CLEAN,
  suspected: PlagiarismVerdict.SUSPECTED,
  confirmed: PlagiarismVerdict.CONFIRMED,
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    @InjectRepository(TestEntity)
    private readonly testRepo: Repository<TestEntity>,
    @Inject(SCORING_PROVIDER)
    private readonly scoringProvider: ScoringProvider,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
    private readonly indexationService: IndexationService,
    // Optional so unit tests need not wire the (global) analytics module.
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async processWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<{ alreadyProcessed: boolean; scoreId: string }> {
    const verification = await this.scoringProvider.verifyWebhookSignature(
      payload,
      signature,
    );

    if (!verification.valid) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const externalId = verification.externalId;
    if (!externalId) {
      throw new BadRequestException('No external ID in webhook payload');
    }

    const assessment = await this.assessmentRepo.findOne({
      where: { externalAssessmentId: externalId },
    });

    if (!assessment) {
      throw new NotFoundException(
        `Assessment not found for externalId ${externalId}`,
      );
    }

    return this.finalizeAssessment(assessment);
  }

  // Local/dev only (see AssessmentController.completeForDev): finish an
  // in-progress attempt the candidate owns, without a real provider webhook.
  // The stub scoring provider produces a deterministic result, so this drives
  // the exact same scoring + indexation path a real webhook would — it is how
  // an assessment becomes "completed" when there is no external exam vendor
  // wired up locally. Owner-scoped; refuses anything not in progress.
  async simulateCompletion(
    candidateId: string,
    assessmentId: string,
  ): Promise<{ alreadyProcessed: boolean; scoreId: string }> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    if (assessment.candidateId !== candidateId) {
      throw new ForbiddenException('Access denied');
    }
    if (assessment.status !== AssessmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Only an in-progress assessment can be completed',
      );
    }
    return this.finalizeAssessment(assessment);
  }

  // Shared tail of the real webhook, the local exam and the dev simulation:
  // persist a result's Score, mark the attempt COMPLETED and re-apply the
  // CVthèque indexation thresholds. Idempotent — a second call for an
  // already-scored assessment is a no-op. When `providedResult` is given (the
  // in-app exam grades locally) it is used as-is; otherwise the result is
  // fetched from the scoring provider.
  async finalizeAssessment(
    assessment: Assessment,
    providedResult?: AssessmentResult,
  ): Promise<{ alreadyProcessed: boolean; scoreId: string }> {
    const externalId = assessment.externalAssessmentId;
    if (!externalId && !providedResult) {
      throw new BadRequestException(
        'Assessment has no external provider reference',
      );
    }

    const existingScore = await this.scoreRepo.findOne({
      where: { assessmentId: assessment.id },
    });

    if (existingScore) {
      this.logger.debug(
        `Webhook already processed for assessment ${assessment.id}`,
      );
      return { alreadyProcessed: true, scoreId: existingScore.id };
    }

    const result =
      providedResult ??
      (externalId ? await this.scoringProvider.getResult(externalId) : null);
    if (!result) {
      throw new BadRequestException(
        `No result available from provider for ${externalId}`,
      );
    }

    const normalizedScore = await this.computeCompositeScore(result);

    const test = await this.testRepo.findOne({
      where: { id: assessment.testId },
    });

    const baremeVersion =
      (await this.settingsService.get('score_bareme_version')) ??
      DEFAULT_BAREME_VERSION;

    const validityDays =
      (await this.settingsService.getNumber('score_validity_days')) ??
      DEFAULT_SCORE_VALIDITY_DAYS;

    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    let plagiarismVerdict =
      PLAGIARISM_MAP[result.plagiarismVerdict] ?? PlagiarismVerdict.CLEAN;
    const answerFingerprint = result.answerFingerprint ?? null;

    // §5.3 plagiarism/collision layer — a first-party copy signal: if another
    // candidate already produced the same answer fingerprint, escalate a CLEAN
    // verdict to SUSPECTED (never downgrade a provider's stronger verdict).
    let fingerprintCollision = false;
    if (answerFingerprint) {
      const collisions = await this.scoreRepo
        .createQueryBuilder('s')
        .innerJoin(
          Assessment,
          'a',
          'a.id = s.assessment_id',
        )
        .where('s.answer_fingerprint = :fp', { fp: answerFingerprint })
        .andWhere('a.candidate_id != :cid', {
          cid: assessment.candidateId,
        })
        .getCount();
      if (collisions > 0) {
        fingerprintCollision = true;
        if (plagiarismVerdict === PlagiarismVerdict.CLEAN) {
          plagiarismVerdict = PlagiarismVerdict.SUSPECTED;
        }
      }
    }

    const score = this.scoreRepo.create({
      assessmentId: assessment.id,
      value: normalizedScore,
      percentile: result.percentile,
      technicalScore: result.technicalScore ?? null,
      psychotechnicalScore: result.psychotechnicalScore ?? null,
      baremeVersion,
      testVersion: test?.version ?? 'unknown',
      plagiarismVerdict,
      answerFingerprint,
      details: result.details,
      domainFeedback: result.domainFeedback,
      expiresAt,
    });

    const savedScore = await this.scoreRepo.save(score);

    assessment.status = AssessmentStatus.COMPLETED;
    assessment.completedAt = new Date();
    await this.assessmentRepo.save(assessment);

    await this.auditService.log({
      actorId: assessment.candidateId,
      action: AuditAction.ASSESSMENT_COMPLETED,
      entityType: 'assessment',
      entityId: assessment.id,
      metadata: { externalId, normalizedScore },
    });

    await this.auditService.log({
      actorId: assessment.candidateId,
      action: AuditAction.SCORE_CALCULATED,
      entityType: 'score',
      entityId: savedScore.id,
      metadata: {
        value: normalizedScore,
        percentile: result.percentile,
        plagiarismVerdict,
        fingerprintCollision,
        baremeVersion,
        testVersion: test?.version,
      },
    });

    // EF-ADM-05 funnel — fire-and-forget.
    void this.analytics?.track(
      AnalyticsEventType.SCORE_OBTAINED,
      assessment.candidateId,
      { value: normalizedScore },
    );

    await this.indexationService.applyThresholds(assessment.candidateId);

    return { alreadyProcessed: false, scoreId: savedScore.id };
  }

  // Weighted 60/40 (configurable) composite when the provider splits its
  // result into technique + psychotechnique sub-scores; falls back to the
  // provider's own already-composited score/maxScore otherwise, so a
  // provider that never adopts the split still works unmodified.
  private async computeCompositeScore(
    result: AssessmentResult,
  ): Promise<number> {
    if (result.technicalScore != null && result.psychotechnicalScore != null) {
      const [techWeight, psychoWeight] = await Promise.all([
        this.settingsService
          .getNumber(TECHNIQUE_WEIGHT_KEY)
          .then((v) => v ?? DEFAULT_TECHNIQUE_WEIGHT),
        this.settingsService
          .getNumber(PSYCHOTECHNIQUE_WEIGHT_KEY)
          .then((v) => v ?? DEFAULT_PSYCHOTECHNIQUE_WEIGHT),
      ]);
      const totalWeight = techWeight + psychoWeight;
      if (totalWeight <= 0) return 0;
      const weighted =
        (result.technicalScore * techWeight +
          result.psychotechnicalScore * psychoWeight) /
        totalWeight;
      return Math.round(weighted * 100) / 100;
    }

    return result.maxScore > 0
      ? Math.round((result.score / result.maxScore) * 100 * 100) / 100
      : 0;
  }
}
