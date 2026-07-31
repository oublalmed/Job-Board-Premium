import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { Score, PlagiarismVerdict } from './entities/score.entity.js';
import { Test as TestEntity } from './entities/test.entity.js';
import type { ScoringProvider } from '../../ports/scoring.port.js';
import { SCORING_PROVIDER } from '../../ports/scoring.port.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { IndexationService } from './indexation.service.js';

const DEFAULT_SCORE_VALIDITY_DAYS = 365;
const DEFAULT_BAREME_VERSION = '1.0';

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

    const existingScore = await this.scoreRepo.findOne({
      where: { assessmentId: assessment.id },
    });

    if (existingScore) {
      this.logger.debug(
        `Webhook already processed for assessment ${assessment.id}`,
      );
      return { alreadyProcessed: true, scoreId: existingScore.id };
    }

    const result = await this.scoringProvider.getResult(externalId);
    if (!result) {
      throw new BadRequestException(
        `No result available from provider for ${externalId}`,
      );
    }

    const normalizedScore =
      result.maxScore > 0
        ? Math.round((result.score / result.maxScore) * 100 * 100) / 100
        : 0;

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

    const plagiarismVerdict =
      PLAGIARISM_MAP[result.plagiarismVerdict] ?? PlagiarismVerdict.CLEAN;

    const score = this.scoreRepo.create({
      assessmentId: assessment.id,
      value: normalizedScore,
      percentile: result.percentile,
      baremeVersion,
      testVersion: test?.version ?? 'unknown',
      plagiarismVerdict,
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
        baremeVersion,
        testVersion: test?.version,
      },
    });

    await this.indexationService.applyThresholds(assessment.candidateId);

    return { alreadyProcessed: false, scoreId: savedScore.id };
  }
}
