import {
  BadRequestException,
  ConflictException,
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
import { ApplyDto } from './dto/apply.dto.js';

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
  ) {}

  // §3.2 — a candidate applies to a published offer (once).
  async apply(
    candidateId: string,
    offerId: string,
    dto: ApplyDto,
  ): Promise<JobApplication> {
    const offer = await this.offerRepo.findOne({ where: { id: offerId } });
    if (!offer || offer.status !== JobStatus.PUBLISHED) {
      throw new NotFoundException('Offer not found');
    }
    const profile = await this.profileRepo.findOne({
      where: { userId: candidateId },
    });
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
