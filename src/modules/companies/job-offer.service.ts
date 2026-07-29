import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobOffer, JobOfferStatus } from './entities/job-offer.entity.js';
import { CreateJobOfferDto } from './dto/create-job-offer.dto.js';
import {
  ModerateJobOfferDto,
  ModerationDecision,
} from './dto/moderate-job-offer.dto.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

@Injectable()
export class JobOfferService {
  constructor(
    @InjectRepository(JobOffer)
    private readonly jobOfferRepo: Repository<JobOffer>,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly auditService: AuditService,
  ) {}

  async createOffer(
    callerId: string,
    dto: CreateJobOfferDto,
  ): Promise<JobOffer> {
    const { companyId } =
      await this.subscriptionGuard.assertActiveSubscription(callerId);

    const offer = await this.jobOfferRepo.save(
      this.jobOfferRepo.create({
        companyId,
        createdBy: callerId,
        title: dto.title,
        description: dto.description ?? null,
        specialtyId: dto.specialtyId ?? null,
        status: JobOfferStatus.PENDING_MODERATION,
      }),
    );

    await this.auditService.log({
      actorId: callerId,
      action: AuditAction.JOB_OFFER_CREATED,
      entityType: 'job_offer',
      entityId: offer.id,
      metadata: { companyId, title: offer.title },
    });

    return offer;
  }

  async listOffers(callerId: string): Promise<JobOffer[]> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);
    return this.jobOfferRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async closeOffer(callerId: string, offerId: string): Promise<JobOffer> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);

    const offer = await this.jobOfferRepo.findOne({
      where: { id: offerId, companyId },
    });
    if (!offer) {
      throw new NotFoundException('Job offer not found');
    }

    if (offer.status !== JobOfferStatus.PUBLISHED) {
      throw new ConflictException('Only a published offer can be closed');
    }

    offer.status = JobOfferStatus.CLOSED;
    const saved = await this.jobOfferRepo.save(offer);

    await this.auditService.log({
      actorId: callerId,
      action: AuditAction.JOB_OFFER_CLOSED,
      entityType: 'job_offer',
      entityId: offer.id,
      metadata: { companyId },
    });

    return saved;
  }

  async moderateOffer(
    moderatorId: string,
    offerId: string,
    dto: ModerateJobOfferDto,
  ): Promise<JobOffer> {
    const offer = await this.jobOfferRepo.findOne({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException('Job offer not found');
    }

    if (offer.status !== JobOfferStatus.PENDING_MODERATION) {
      throw new ConflictException('Only a pending offer can be moderated');
    }

    offer.status =
      dto.decision === ModerationDecision.APPROVE
        ? JobOfferStatus.PUBLISHED
        : JobOfferStatus.REJECTED;
    offer.moderatedBy = moderatorId;
    offer.moderatedAt = new Date();
    offer.rejectionReason =
      dto.decision === ModerationDecision.REJECT
        ? (dto.rejectionReason ?? null)
        : null;

    const saved = await this.jobOfferRepo.save(offer);

    await this.auditService.log({
      actorId: moderatorId,
      action: AuditAction.JOB_OFFER_MODERATED,
      entityType: 'job_offer',
      entityId: offer.id,
      metadata: { decision: dto.decision, companyId: offer.companyId },
    });

    return saved;
  }
}
