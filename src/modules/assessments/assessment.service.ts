import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, MoreThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Inject, Optional } from '@nestjs/common';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AnalyticsEventType } from '../analytics/entities/analytics-event.entity.js';
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

// §5.3 anti-cheat — how far back to look for the same device/IP used by a
// different candidate. Overridable via the settings store.
const MULTI_ACCOUNT_WINDOW_KEY = 'anti_cheat_multi_account_window_hours';
const DEFAULT_MULTI_ACCOUNT_WINDOW_HOURS = 24;

/** Request-scoped signals used by the anti-cheat multi-account layer. */
export interface AssessmentStartContext {
  ipAddress?: string | null;
  deviceFingerprint?: string | null;
}

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
    // Optional so unit tests that construct this service without the (global)
    // AnalyticsModule keep working — analytics is never a hard dependency.
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async startAssessment(
    candidateId: string,
    testId: string,
    context: AssessmentStartContext = {},
  ): Promise<{ assessment: Assessment; assessmentUrl: string }> {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) {
      throw new NotFoundException('Test not found');
    }
    if (!test.active) {
      throw new BadRequestException('Test is not active');
    }

    await this.checkEligibility(candidateId, testId);

    const ipAddress = context.ipAddress?.trim() || null;
    const deviceFingerprint = context.deviceFingerprint?.trim() || null;
    const sharedBy = await this.detectMultiAccount(
      candidateId,
      ipAddress,
      deviceFingerprint,
    );
    const multiAccountFlagged = sharedBy !== null;

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

    // IN_PROGRESS, not PENDING — found building Front 1's session screen:
    // reportIncident requires status === IN_PROGRESS, and nothing anywhere
    // in this service ever transitioned a freshly-started assessment out
    // of PENDING (resumeAssessment only accepts status === INCIDENT).
    // A PENDING assessment could therefore never validly report an
    // incident at all — structurally unreachable. There is no distinct
    // "candidate acknowledged the vendor session" step in this
    // architecture: once assessmentUrl is issued, the candidate can
    // immediately begin the test, so the session is genuinely in
    // progress from creation.
    const assessment = this.assessmentRepo.create({
      candidateId,
      testId,
      externalAssessmentId: externalId,
      status: AssessmentStatus.IN_PROGRESS,
      resumeToken: uuidv4(),
      expiresAt,
      startedAt: now,
      ipAddress,
      deviceFingerprint,
      multiAccountFlagged,
    });

    const saved = await this.assessmentRepo.save(assessment);

    await this.auditService.log({
      actorId: candidateId,
      action: AuditAction.ASSESSMENT_STARTED,
      entityType: 'assessment',
      entityId: saved.id,
      metadata: { testId, externalId },
    });

    // Raise a moderation signal (never a hard block — shared NAT/corporate IPs
    // would false-positive) when this device/IP was just used by someone else.
    if (multiAccountFlagged) {
      await this.auditService.log({
        actorId: candidateId,
        action: AuditAction.ASSESSMENT_MULTI_ACCOUNT_FLAGGED,
        entityType: 'assessment',
        entityId: saved.id,
        ipAddress,
        metadata: { testId, sharedBy },
      });
    }

    // EF-ADM-05 funnel — fire-and-forget.
    void this.analytics?.track(AnalyticsEventType.TEST_STARTED, candidateId, {
      testId,
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

  /**
   * §5.3 anti-cheat (multi-account layer). Returns why the start is suspicious
   * — `'device'` or `'ip'` — when the same non-null signal was used by a
   * DIFFERENT candidate inside the detection window, else `null`. Device
   * fingerprint is checked first (far more specific than a shared IP).
   */
  private async detectMultiAccount(
    candidateId: string,
    ipAddress: string | null,
    deviceFingerprint: string | null,
  ): Promise<'device' | 'ip' | null> {
    if (!ipAddress && !deviceFingerprint) {
      return null;
    }

    const windowHours =
      (await this.settingsService.getNumber(MULTI_ACCOUNT_WINDOW_KEY)) ??
      DEFAULT_MULTI_ACCOUNT_WINDOW_HOURS;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    if (deviceFingerprint) {
      const byDevice = await this.assessmentRepo.count({
        where: {
          deviceFingerprint,
          candidateId: Not(candidateId),
          createdAt: MoreThanOrEqual(since),
        },
      });
      if (byDevice > 0) {
        return 'device';
      }
    }

    if (ipAddress) {
      const byIp = await this.assessmentRepo.count({
        where: {
          ipAddress,
          candidateId: Not(candidateId),
          createdAt: MoreThanOrEqual(since),
        },
      });
      if (byIp > 0) {
        return 'ip';
      }
    }

    return null;
  }
}
