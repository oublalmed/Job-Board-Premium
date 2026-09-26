import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment, AssessmentStatus } from './entities/assessment.entity.js';
import { Test as TestEntity } from './entities/test.entity.js';
import { Specialty } from './entities/specialty.entity.js';
import { WebhookService } from './webhook.service.js';
import { examForSpecialty, type ExamQuestion } from './assessment-questions.js';
import type {
  AssessmentResult,
  DomainFeedbackEntry,
  DomainFeedbackLevel,
} from '../../ports/scoring.port.js';

// Client-facing question (answer key stripped).
export interface ExamQuestionPublic {
  id: string;
  type: 'technical' | 'psychotechnical';
  domain: string;
  prompt: string;
  options: string[];
}

export interface ExamPayload {
  assessmentId: string;
  specialtyName: string | null;
  technicalCount: number;
  psychotechnicalCount: number;
  questions: ExamQuestionPublic[];
}

// The in-app exam: serves real questions for an in-progress attempt and grades
// the submitted answers locally (no external scoring vendor), then completes the
// assessment through the same persistence path a provider webhook would use.
@Injectable()
export class ExamService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(TestEntity)
    private readonly testRepo: Repository<TestEntity>,
    @InjectRepository(Specialty)
    private readonly specialtyRepo: Repository<Specialty>,
    private readonly webhookService: WebhookService,
  ) {}

  async getExam(candidateId: string, assessmentId: string): Promise<ExamPayload> {
    const { assessment, questions, specialtyName } = await this.loadContext(
      candidateId,
      assessmentId,
    );
    void assessment;
    return {
      assessmentId,
      specialtyName,
      technicalCount: questions.filter((q) => q.type === 'technical').length,
      psychotechnicalCount: questions.filter(
        (q) => q.type === 'psychotechnical',
      ).length,
      // Strip the answer key before it ever leaves the server.
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        domain: q.domain,
        prompt: q.prompt,
        options: q.options,
      })),
    };
  }

  async submitExam(
    candidateId: string,
    assessmentId: string,
    answers: Record<string, number>,
  ): Promise<{ scoreValue: number; technicalScore: number; psychotechnicalScore: number }> {
    const { assessment, questions } = await this.loadContext(
      candidateId,
      assessmentId,
    );

    const graded = this.grade(questions, answers ?? {});
    const externalId = assessment.externalAssessmentId ?? assessmentId;

    const result: AssessmentResult = {
      externalId,
      score: graded.composite,
      maxScore: 100,
      percentile: Math.round(graded.composite),
      plagiarismVerdict: 'clean',
      details: {
        local: true,
        correct: graded.correct,
        total: graded.total,
      },
      domainFeedback: graded.domainFeedback,
      technicalScore: graded.technicalScore,
      psychotechnicalScore: graded.psychotechnicalScore,
      // Unique per attempt so the exam never triggers a spurious collision flag.
      answerFingerprint: `local-${externalId}`,
    };

    await this.webhookService.finalizeAssessment(assessment, result);

    return {
      scoreValue: graded.composite,
      technicalScore: graded.technicalScore,
      psychotechnicalScore: graded.psychotechnicalScore,
    };
  }

  private async loadContext(
    candidateId: string,
    assessmentId: string,
  ): Promise<{
    assessment: Assessment;
    questions: ExamQuestion[];
    specialtyName: string | null;
  }> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.candidateId !== candidateId) {
      throw new ForbiddenException('Access denied');
    }
    if (assessment.status !== AssessmentStatus.IN_PROGRESS) {
      throw new BadRequestException('Assessment is not in progress');
    }

    const test = await this.testRepo.findOne({
      where: { id: assessment.testId },
    });
    const specialty = test
      ? await this.specialtyRepo.findOne({ where: { id: test.specialtyId } })
      : null;
    const specialtyName = specialty?.name ?? null;

    return {
      assessment,
      questions: examForSpecialty(specialtyName),
      specialtyName,
    };
  }

  private grade(
    questions: ExamQuestion[],
    answers: Record<string, number>,
  ): {
    composite: number;
    technicalScore: number;
    psychotechnicalScore: number;
    correct: number;
    total: number;
    domainFeedback: DomainFeedbackEntry[];
  } {
    const tech = questions.filter((q) => q.type === 'technical');
    const psy = questions.filter((q) => q.type === 'psychotechnical');

    const score = (set: ExamQuestion[]): number =>
      set.length === 0
        ? 0
        : Math.round(
            (set.filter((q) => answers[q.id] === q.correct).length /
              set.length) *
              100,
          );

    const technicalScore = score(tech);
    const psychotechnicalScore = score(psy);
    const composite = Math.round(
      technicalScore * 0.6 + psychotechnicalScore * 0.4,
    );
    const correct = questions.filter(
      (q) => answers[q.id] === q.correct,
    ).length;

    // Per-domain strengths/weaknesses for the remediation feedback.
    const byDomain = new Map<string, { correct: number; total: number }>();
    for (const q of questions) {
      const entry = byDomain.get(q.domain) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (answers[q.id] === q.correct) entry.correct += 1;
      byDomain.set(q.domain, entry);
    }
    const level = (ratio: number): DomainFeedbackLevel =>
      ratio >= 0.7 ? 'strong' : ratio >= 0.4 ? 'medium' : 'weak';
    const domainFeedback: DomainFeedbackEntry[] = [...byDomain.entries()].map(
      ([domain, s]) => ({ domain, level: level(s.correct / s.total) }),
    );

    return {
      composite,
      technicalScore,
      psychotechnicalScore,
      correct,
      total: questions.length,
      domainFeedback,
    };
  }
}
