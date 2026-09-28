import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assessment } from '../assessments/entities/assessment.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import {
  computeSuspicionLevel,
  countSuspiciousEvents,
  type SuspicionLevel,
} from './anti-cheat.js';

export interface CandidateIntegrity {
  // Whether the company has the anti-cheat option turned on.
  antiCheatEnabled: boolean;
  assessmentsCount: number;
  tabSwitchCount: number;
  windowBlurCount: number;
  proctoringFlagged: boolean;
  multiAccountFlagged: boolean;
  suspiciousEvents: number;
  level: SuspicionLevel;
}

@Injectable()
export class AntiCheatService {
  constructor(
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async getSetting(companyId: string): Promise<{ enabled: boolean }> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });
    return { enabled: company?.antiCheatEnabled ?? true };
  }

  async setSetting(
    companyId: string,
    enabled: boolean,
  ): Promise<{ enabled: boolean }> {
    await this.companyRepo.update(
      { id: companyId },
      {
        antiCheatEnabled: enabled,
      },
    );
    return { enabled };
  }

  // Aggregate anti-cheat indicators for a candidate across their assessments.
  async getCandidateIntegrity(
    companyId: string,
    candidateProfileId: string,
  ): Promise<CandidateIntegrity> {
    const { enabled } = await this.getSetting(companyId);

    const profile = await this.profileRepo.findOne({
      where: { id: candidateProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Candidate not found');
    }

    const assessments = await this.assessmentRepo.find({
      where: { candidateId: profile.userId },
    });

    const signals = {
      tabSwitchCount: assessments.reduce(
        (n, a) => n + (a.tabSwitchCount ?? 0),
        0,
      ),
      windowBlurCount: assessments.reduce(
        (n, a) => n + (a.windowBlurCount ?? 0),
        0,
      ),
      proctoringFlagged: assessments.some((a) => a.proctoringFlagged),
      multiAccountFlagged: assessments.some((a) => a.multiAccountFlagged),
    };

    return {
      antiCheatEnabled: enabled,
      assessmentsCount: assessments.length,
      ...signals,
      suspiciousEvents: countSuspiciousEvents(signals),
      level: computeSuspicionLevel(signals),
    };
  }
}
