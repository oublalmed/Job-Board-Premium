import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { Score } from './entities/score.entity.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  COOLDOWN_SETTINGS_KEY,
  DEFAULT_COOLDOWN_DAYS,
  computeCooldownEnd,
} from './cooldown.js';

export interface AssessmentHistoryItem {
  id: string;
  testId: string;
  specialtyName: string | null;
  status: AssessmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  score: {
    value: number;
    percentile: number | null;
    technicalScore: number | null;
    psychotechnicalScore: number | null;
  } | null;
}

export interface AssessmentHistory {
  items: AssessmentHistoryItem[];
  cooldownDays: number;
  eligibleNow: boolean;
  // ISO date of the next moment the candidate may retake, or null if eligible
  // now (or has never completed an assessment).
  nextEligibleAt: string | null;
}

// Numeric TypeORM columns come back as strings — normalize to number|null.
function num(v: number | string | null): number | null {
  return v === null || v === undefined ? null : Number(v);
}

@Injectable()
export class AssessmentHistoryService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(Score)
    private readonly scoreRepo: Repository<Score>,
    private readonly settingsService: SettingsService,
  ) {}

  async getHistory(candidateId: string): Promise<AssessmentHistory> {
    const assessments = await this.assessmentRepo.find({
      where: { candidateId },
      relations: { test: { specialty: true } },
      order: { createdAt: 'DESC' },
    });

    const scores = assessments.length
      ? await this.scoreRepo.find({
          where: { assessmentId: In(assessments.map((a) => a.id)) },
        })
      : [];
    const scoreByAssessment = new Map(scores.map((s) => [s.assessmentId, s]));

    const items: AssessmentHistoryItem[] = assessments.map((a) => {
      const s = scoreByAssessment.get(a.id) ?? null;
      return {
        id: a.id,
        testId: a.testId,
        specialtyName: a.test?.specialty?.name ?? null,
        status: a.status,
        startedAt: a.startedAt ? a.startedAt.toISOString() : null,
        completedAt: a.completedAt ? a.completedAt.toISOString() : null,
        score: s
          ? {
              value: num(s.value) ?? 0,
              percentile: num(s.percentile),
              technicalScore: num(s.technicalScore),
              psychotechnicalScore: num(s.psychotechnicalScore),
            }
          : null,
      };
    });

    const cooldownDays =
      (await this.settingsService.getNumber(COOLDOWN_SETTINGS_KEY)) ??
      DEFAULT_COOLDOWN_DAYS;

    // Eligibility is summarised from the most recent completed assessment
    // across all tests — same cooldown rule enforced per test in
    // AssessmentService.checkEligibility, surfaced here for the UI.
    const lastCompleted = assessments
      .filter((a) => a.status === AssessmentStatus.COMPLETED && a.completedAt)
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];

    let eligibleNow = true;
    let nextEligibleAt: string | null = null;
    if (lastCompleted?.completedAt) {
      const cooldownEnd = computeCooldownEnd(
        lastCompleted.completedAt,
        cooldownDays,
      );
      if (cooldownEnd > new Date()) {
        eligibleNow = false;
        nextEligibleAt = cooldownEnd.toISOString();
      }
    }

    return { items, cooldownDays, eligibleNow, nextEligibleAt };
  }
}
