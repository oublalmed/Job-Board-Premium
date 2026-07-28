import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShortlistEntry } from './entities/shortlist-entry.entity.js';
import { Recruiter } from './entities/recruiter.entity.js';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../candidates/entities/candidate-profile.entity.js';
import { AddShortlistEntryDto } from './dto/add-shortlist-entry.dto.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';

@Injectable()
export class ShortlistService {
  constructor(
    @InjectRepository(ShortlistEntry)
    private readonly shortlistRepo: Repository<ShortlistEntry>,
    @InjectRepository(Recruiter)
    private readonly recruiterRepo: Repository<Recruiter>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly auditService: AuditService,
  ) {}

  private async getCallerCompanyId(callerId: string): Promise<string> {
    const recruiter = await this.recruiterRepo.findOne({
      where: { userId: callerId },
    });
    if (!recruiter) {
      throw new NotFoundException('No company associated with this account');
    }
    return recruiter.companyId;
  }

  async addEntry(
    callerId: string,
    dto: AddShortlistEntryDto,
  ): Promise<ShortlistEntry> {
    const { companyId } =
      await this.subscriptionGuard.assertActiveSubscription(callerId);

    const profile = await this.profileRepo.findOne({
      where: { id: dto.candidateProfileId },
    });
    if (
      !profile ||
      !profile.indexedInCvtheque ||
      profile.visibility === ProfileVisibility.HIDDEN
    ) {
      throw new NotFoundException('Candidate profile not found');
    }

    const existing = await this.shortlistRepo.findOne({
      where: { companyId, candidateProfileId: dto.candidateProfileId },
    });
    if (existing) {
      throw new ConflictException(
        'This candidate is already in your shortlist',
      );
    }

    const entry = await this.shortlistRepo.save(
      this.shortlistRepo.create({
        companyId,
        candidateProfileId: dto.candidateProfileId,
        addedBy: callerId,
        note: dto.note ?? null,
      }),
    );

    await this.auditService.log({
      actorId: callerId,
      action: AuditAction.SHORTLIST_ENTRY_ADDED,
      entityType: 'shortlist_entry',
      entityId: entry.id,
      metadata: { companyId, candidateProfileId: dto.candidateProfileId },
    });

    return entry;
  }

  async listEntries(callerId: string): Promise<ShortlistEntry[]> {
    const companyId = await this.getCallerCompanyId(callerId);
    return this.shortlistRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async removeEntry(callerId: string, entryId: string): Promise<void> {
    const companyId = await this.getCallerCompanyId(callerId);

    const entry = await this.shortlistRepo.findOne({
      where: { id: entryId },
    });
    if (!entry || entry.companyId !== companyId) {
      throw new NotFoundException('Shortlist entry not found');
    }

    await this.shortlistRepo.delete({ id: entryId });

    await this.auditService.log({
      actorId: callerId,
      action: AuditAction.SHORTLIST_ENTRY_REMOVED,
      entityType: 'shortlist_entry',
      entityId: entryId,
      metadata: { companyId },
    });
  }
}
