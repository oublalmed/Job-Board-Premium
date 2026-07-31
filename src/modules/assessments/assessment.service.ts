import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Inject } from '@nestjs/common';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { Test as TestEntity } from './entities/test.entity.js';
import type { ScoringProvider } from '../../ports/scoring.port.js';
import { SCORING_PROVIDER } from '../../ports/scoring.port.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import {
  COOLDOWN_SETTINGS_KEY,
  DEFAULT_COOLDOWN_DAYS,
  computeCooldownEnd,
} from './cooldown.js';

@Injectable()
export class AssessmentService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(TestEntity)
    private readonly testRepo: Repository<TestEntity>,
    @Inject(SCORING_PROVIDER)
    private readonly scoringProvider: ScoringProvider,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  async startAssessment(
    candidateId: string,
    testId: string,
  ): Promise<{ assessment: Assessment; assessmentUrl: string }> {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) {
      throw new NotFoundException('Test not found');
    }
    if (!test.active) {
      throw new BadRequestException('Test is not active');
    }

    await this.checkEligibility(candidateId, testId);

    const { externalId, assessmentUrl } =
      await this.scoringProvider.createAssessment({
        candidateId,
        specialtyId: test.specialtyId,
        testId,
      });

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + test.durationMinutes * 60 * 1000,
    );

    const assessment = this.assessmentRepo.create({
      candidateId,
      testId,
      externalAssessmentId: externalId,
      status: AssessmentStatus.PENDING,
      resumeToken: uuidv4(),
      expiresAt,
      startedAt: now,
    });

    const saved = await this.assessmentRepo.save(assessment);

    await this.auditService.log({
      actorId: candidateId,
      action: AuditAction.ASSESSMENT_STARTED,
      entityType: 'assessment',
      entityId: saved.id,
      metadata: { testId, externalId },
    });

    return { assessment: saved, assessmentUrl };
  }

  async resumeAssessment(
    candidateId: string,
    assessmentId: string,
    resumeToken: string,
  ): Promise<{ assessment: Assessment; assessmentUrl: string }> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.candidateId !== candidateId) {
      throw new ForbiddenException('Access denied');
    }

    if (assessment.status !== AssessmentStatus.INCIDENT) {
      throw new BadRequestException(
        'Only assessments in INCIDENT status can be resumed',
      );
    }

    if (assessment.resumeToken !== resumeToken) {
      throw new ForbiddenException('Invalid resume token');
    }

    assessment.status = AssessmentStatus.IN_PROGRESS;
    assessment.resumeToken = uuidv4();

    const saved = await this.assessmentRepo.save(assessment);

    await this.auditService.log({
      actorId: candidateId,
      action: AuditAction.ASSESSMENT_RESUMED,
      entityType: 'assessment',
      entityId: saved.id,
    });

    const assessmentUrl = `https://scoring.local/assessment/${assessment.externalAssessmentId}`;

    return { assessment: saved, assessmentUrl };
  }

  async reportIncident(
    candidateId: string,
    assessmentId: string,
  ): Promise<Assessment> {
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
        'Only IN_PROGRESS assessments can report incidents',
      );
    }

    assessment.status = AssessmentStatus.INCIDENT;

    const saved = await this.assessmentRepo.save(assessment);

    await this.auditService.log({
      actorId: candidateId,
      action: AuditAction.ASSESSMENT_INCIDENT,
      entityType: 'assessment',
      entityId: saved.id,
    });

    return saved;
  }

  private async checkEligibility(
    candidateId: string,
    testId: string,
  ): Promise<void> {
    const activeAssessment = await this.assessmentRepo.findOne({
      where: {
        candidateId,
        testId,
        status: In([AssessmentStatus.PENDING, AssessmentStatus.IN_PROGRESS]),
      },
    });

    if (activeAssessment) {
      throw new ConflictException(
        'An assessment is already in progress for this test',
      );
    }

    const cooldownDays =
      (await this.settingsService.getNumber(COOLDOWN_SETTINGS_KEY)) ??
      DEFAULT_COOLDOWN_DAYS;

    const lastCompleted = await this.assessmentRepo.findOne({
      where: {
        candidateId,
        testId,
        status: AssessmentStatus.COMPLETED,
      },
      order: { completedAt: 'DESC' },
    });

    if (lastCompleted?.completedAt) {
      const cooldownEnd = computeCooldownEnd(
        lastCompleted.completedAt,
        cooldownDays,
      );

      if (cooldownEnd > new Date()) {
        throw new ConflictException({
          message: `Cooldown period active. Re-eligible on ${cooldownEnd.toISOString().split('T')[0]}`,
          reEligibleAt: cooldownEnd.toISOString(),
          statusCode: 409,
        });
      }
    }
  }
}
