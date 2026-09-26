import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from './entities/assessment.entity.js';

export interface IntegrityRow {
  assessmentId: string;
  candidateEmail: string | null;
  specialtyName: string | null;
  status: string;
  score: number | null;
  tabSwitchCount: number;
  windowBlurCount: number;
  proctoringFlagged: boolean;
  multiAccountFlagged: boolean;
  plagiarismVerdict: string | null;
  ipAddress: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface IntegrityList {
  items: IntegrityRow[];
  counts: {
    proctoring: number;
    multiAccount: number;
    plagiarism: number;
    total: number;
  };
}

interface RawRow {
  assessmentId: string;
  candidateEmail: string | null;
  specialtyName: string | null;
  status: string;
  score: string | null;
  tabSwitchCount: string | number;
  windowBlurCount: string | number;
  proctoringFlagged: boolean;
  multiAccountFlagged: boolean;
  plagiarismVerdict: string | null;
  ipAddress: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// Admin-side exam integrity / anti-cheat overview. Surfaces the first-party
// signals already captured during an attempt — secure-exam tab-switch/blur
// counts, the multi-account (same device/IP) flag, and the plagiarism verdict —
// so staff can review candidates who likely cheated.
@Injectable()
export class ProctoringAdminService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
  ) {}

  async list(onlyFlagged = true): Promise<IntegrityList> {
    const base = () =>
      this.assessmentRepo
        .createQueryBuilder('a')
        .leftJoin('a.candidate', 'u')
        .leftJoin('a.test', 't')
        .leftJoin('t.specialty', 's')
        .leftJoin('scores', 'sc', 'sc.assessment_id = a.id');

    const flaggedWhere =
      'a.proctoringFlagged = true OR a.multiAccountFlagged = true OR sc.plagiarism_verdict IN (:...verdicts)';
    const verdicts = ['suspected', 'confirmed'];

    const qb = base()
      .select('a.id', 'assessmentId')
      .addSelect('u.email', 'candidateEmail')
      .addSelect('s.name', 'specialtyName')
      .addSelect('a.status', 'status')
      .addSelect('sc.value', 'score')
      .addSelect('a.tabSwitchCount', 'tabSwitchCount')
      .addSelect('a.windowBlurCount', 'windowBlurCount')
      .addSelect('a.proctoringFlagged', 'proctoringFlagged')
      .addSelect('a.multiAccountFlagged', 'multiAccountFlagged')
      .addSelect('sc.plagiarism_verdict', 'plagiarismVerdict')
      .addSelect('a.ipAddress', 'ipAddress')
      .addSelect('a.startedAt', 'startedAt')
      .addSelect('a.completedAt', 'completedAt')
      .orderBy('a.updatedAt', 'DESC')
      .limit(200);

    if (onlyFlagged) {
      qb.where(flaggedWhere, { verdicts });
    }

    const raw = await qb.getRawMany<RawRow>();

    const items: IntegrityRow[] = raw.map((r) => ({
      assessmentId: r.assessmentId,
      candidateEmail: r.candidateEmail,
      specialtyName: r.specialtyName,
      status: r.status,
      score: r.score !== null && r.score !== undefined ? Number(r.score) : null,
      tabSwitchCount: Number(r.tabSwitchCount ?? 0),
      windowBlurCount: Number(r.windowBlurCount ?? 0),
      proctoringFlagged: r.proctoringFlagged === true,
      multiAccountFlagged: r.multiAccountFlagged === true,
      plagiarismVerdict: r.plagiarismVerdict ?? null,
      ipAddress: r.ipAddress,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    }));

    // Counts across ALL flagged assessments (independent of the filter above).
    const countRow = await base()
      .select('COUNT(*) FILTER (WHERE a.proctoring_flagged)', 'proctoring')
      .addSelect('COUNT(*) FILTER (WHERE a.multi_account_flagged)', 'multiAccount')
      .addSelect(
        "COUNT(*) FILTER (WHERE sc.plagiarism_verdict IN ('suspected','confirmed'))",
        'plagiarism',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE a.proctoring_flagged OR a.multi_account_flagged OR sc.plagiarism_verdict IN ('suspected','confirmed'))",
        'total',
      )
      .getRawOne<{
        proctoring: string;
        multiAccount: string;
        plagiarism: string;
        total: string;
      }>();

    return {
      items,
      counts: {
        proctoring: Number(countRow?.proctoring ?? 0),
        multiAccount: Number(countRow?.multiAccount ?? 0),
        plagiarism: Number(countRow?.plagiarism ?? 0),
        total: Number(countRow?.total ?? 0),
      },
    };
  }
}
