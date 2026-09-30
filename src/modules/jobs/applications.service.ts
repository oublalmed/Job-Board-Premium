import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobOffer, JobStatus } from './entities/job-offer.entity.js';
import {
  JobApplication,
  ApplicationStatus,
} from './entities/job-application.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import {
  Assessment,
  AssessmentStatus,
} from '../assessments/entities/assessment.entity.js';
import { ApplyDto } from './dto/apply.dto.js';

// §3 (éligibilité) — a candidate may apply only with a profile that is at least
// this complete AND at least one finished assessment. Enforced here at the API
// (the frontend mirrors it, but this is the gate that can't be bypassed).
export const APPLY_MIN_COMPLETENESS = 70;

export type EligibilityReason =
  | 'PROFILE_INCOMPLETE'
  | 'NO_COMPLETED_ASSESSMENT';

export interface ApplyEligibility {
  eligible: boolean;
  completeness: number;
  threshold: number;
  completedAssessments: number;
  reasons: EligibilityReason[];
}

// What a candidate sees for their own application.
export interface MyApplicationView {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  offer: {
    id: string;
    title: string;
    companyName: string | null;
    status: JobStatus;
  };
}

// What a recruiter sees for an application to their offer (applicant is
// identified — applying is opt-in consent to reveal identity).
export interface RecruiterApplicationView {
  id: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  createdAt: Date;
  candidate: {
    profileId: string;
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(JobApplication)
    private readonly appRepo: Repository<JobApplication>,
    @InjectRepository(JobOffer)
    private readonly offerRepo: Repository<JobOffer>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
  ) {}

  // §3 — the eligibility a candidate must meet to apply. Exposed so the
  // frontend can show what's still missing before the apply form.
  async getEligibility(candidateId: string): Promise<ApplyEligibility> {
    return (await this.computeEligibility(candidateId)).eligibility;
  }

  private async computeEligibility(candidateId: string): Promise<{
    profile: CandidateProfile | null;
    eligibility: ApplyEligibility;
  }> {
    const profile = await this.profileRepo.findOne({
      where: { userId: candidateId },
    });
    // `completeness` is a decimal column → comes back as a string.
    const completeness = profile ? Number(profile.completeness) : 0;
    const completedAssessments = await this.assessmentRepo.count({
      where: { candidateId, status: AssessmentStatus.COMPLETED },
    });

    const reasons: EligibilityReason[] = [];
    if (completeness < APPLY_MIN_COMPLETENESS) reasons.push('PROFILE_INCOMPLETE');
    if (completedAssessments < 1) reasons.push('NO_COMPLETED_ASSESSMENT');

    return {
      profile,
      eligibility: {
        eligible: reasons.length === 0,
        completeness,
        threshold: APPLY_MIN_COMPLETENESS,
        completedAssessments,
        reasons,
      },
    };
  }

  // §3.2 — a candidate applies to a published offer (once), if eligible.
  async apply(
    candidateId: string,
    offerId: string,
    dto: ApplyDto,
  ): Promise<JobApplication> {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer || offer.status !== JobStatus.PUBLISHED) {
      throw new NotFoundException('Offer not found');
    }

    // §3 eligibility gate — profile >= 70% AND >= 1 completed assessment.
    const { profile, eligibility } = await this.computeEligibility(candidateId);
    if (!eligibility.eligible) {
      throw new ForbiddenException({
        error: 'APPLICATION_NOT_ELIGIBLE',
        ...eligibility,
      });
    }
    if (!profile) {
      throw new BadRequestException('Complétez votre profil avant de postuler');
    }

    const existing = await this.appRepo.findOne({
      where: { jobOfferId: offerId, candidateId },
    });
    if (existing) {
      throw new ConflictException('Vous avez déjà postulé à cette offre');
    }
    return this.appRepo.save(
      this.appRepo.create({
        jobOfferId: offerId,
        candidateId,
        candidateProfileId: profile.id,
        coverLetter: dto.coverLetter ?? null,
        status: ApplicationStatus.APPLIED,
      }),
    );
  }

  // §3.2 — the candidate's own applications + their statuses.
  async listMine(candidateId: string): Promise<MyApplicationView[]> {
    const apps = await this.appRepo.find({
      where: { candidateId },
      relations: { jobOffer: { company: true } },
      order: { createdAt: 'DESC' },
    });
    return apps.map((a) => ({
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      offer: {
        id: a.jobOffer.id,
        title: a.jobOffer.title,
        companyName: a.jobOffer.company?.name ?? null,
        status: a.jobOffer.status,
      },
    }));
  }

  // §3.1 — applications to one of the recruiter's own offers.
  async listForOffer(
    offerId: string,
    companyId: string,
  ): Promise<RecruiterApplicationView[]> {
    const offer = await this.offerRepo.findOne({
      where: { id: offerId, companyId },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    const apps = await this.appRepo.find({
      where: { jobOfferId: offerId },
      relations: { candidateProfile: true },
      order: { createdAt: 'DESC' },
    });
    return apps.map((a) => ({
      id: a.id,
      status: a.status,
      coverLetter: a.coverLetter,
      createdAt: a.createdAt,
      candidate: {
        profileId: a.candidateProfileId,
        firstName: a.candidateProfile?.firstName ?? null,
        lastName: a.candidateProfile?.lastName ?? null,
        headline: a.candidateProfile?.headline ?? null,
      },
    }));
  }

  // §3.4 — recruiter moves an application through the workflow; scoped to the
  // recruiter's company (the application's offer must belong to it).
  async updateStatus(
    applicationId: string,
    companyId: string,
    status: ApplicationStatus,
  ): Promise<JobApplication> {
    const app = await this.appRepo.findOne({
      where: { id: applicationId },
      relations: { jobOffer: true },
    });
    if (!app || app.jobOffer.companyId !== companyId) {
      throw new NotFoundException('Application not found');
    }
    app.status = status;
    return this.appRepo.save(app);
  }
}
