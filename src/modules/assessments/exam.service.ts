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

// Client-facing question (answer rubric stripped). These are open-ended: the
// candidate writes a free-text answer.
export interface ExamQuestionPublic {
  id: string;
  type: 'technical' | 'psychotechnical';
  category: string;
  domain: string;
  level: string;
  timeSeconds: number;
  prompt: string;
}

export interface ExamPayload {
  assessmentId: string;
  specialtyName: string | null;
  technicalCount: number;
  psychotechnicalCount: number;
  questions: ExamQuestionPublic[];
}

// A substantive open-ended answer: enough characters and words to be a genuine
// attempt (not blank or a token). This is the auto-grade signal for free text —
// it measures whether the candidate engaged with the question. Deep correctness
// grading would need an AI/human reviewer.
const MIN_CHARS = 40;
const MIN_WORDS = 8;

function isSubstantive(answer: string | undefined): boolean {
  const a = (answer ?? '').trim();
  if (a.length < MIN_CHARS) return false;
  return a.split(/\s+/).filter(Boolean).length >= MIN_WORDS;
}

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
    const { questions, specialtyName } = await this.loadContext(
      candidateId,
      assessmentId,
    );
    return {
      assessmentId,
      specialtyName,
      technicalCount: questions.filter((q) => q.type === 'technical').length,
      psychotechnicalCount: questions.filter(
        (q) => q.type === 'psychotechnical',
      ).length,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        category: q.category,
        domain: q.domain,
        level: q.level,
        timeSeconds: q.timeSeconds,
        prompt: q.prompt,
      })),
    };
  }

  async submitExam(
    candidateId: string,
    assessmentId: string,
    answers: Record<string, string>,
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
        answered: graded.answered,
        total: graded.total,
        openEnded: true,
      },
      domainFeedback: graded.domainFeedback,
      technicalScore: graded.technicalScore,
      psychotechnicalScore: graded.psychotechnicalScore,
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

    // Seeded by the assessment id so getExam and submit see the same set.
    return {
      assessment,
      questions: examForSpecialty(specialtyName, assessment.id),
      specialtyName,
    };
  }

  private grade(
    questions: ExamQuestion[],
    answers: Record<string, string>,
  ): {
    composite: number;
    technicalScore: number;
    psychotechnicalScore: number;
    answered: number;
    total: number;
    domainFeedback: DomainFeedbackEntry[];
  } {
    const tech = questions.filter((q) => q.type === 'technical');
    const psy = questions.filter((q) => q.type === 'psychotechnical');

    const score = (set: ExamQuestion[]): number =>
      set.length === 0
        ? 0
        : Math.round(
            (set.filter((q) => isSubstantive(answers[q.id])).length /
              set.length) *
              100,
          );

    const technicalScore = score(tech);
    const psychotechnicalScore = score(psy);
    const composite = Math.round(
      technicalScore * 0.6 + psychotechnicalScore * 0.4,
    );
    const answered = questions.filter((q) =>
      isSubstantive(answers[q.id]),
    ).length;

    const byDomain = new Map<string, { ok: number; total: number }>();
    for (const q of questions) {
      const entry = byDomain.get(q.domain) ?? { ok: 0, total: 0 };
      entry.total += 1;
      if (isSubstantive(answers[q.id])) entry.ok += 1;
      byDomain.set(q.domain, entry);
    }
    const level = (ratio: number): DomainFeedbackLevel =>
      ratio >= 0.7 ? 'strong' : ratio >= 0.4 ? 'medium' : 'weak';
    const domainFeedback: DomainFeedbackEntry[] = [...byDomain.entries()].map(
      ([domain, s]) => ({ domain, level: level(s.ok / s.total) }),
    );

    return {
      composite,
      technicalScore,
      psychotechnicalScore,
      answered,
      total: questions.length,
      domainFeedback,
    };
  }
}
