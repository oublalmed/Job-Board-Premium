import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShortlistEntry } from './entities/shortlist-entry.entity.js';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../candidates/entities/candidate-profile.entity.js';
import { AddShortlistEntryDto } from './dto/add-shortlist-entry.dto.js';
import { SubscriptionGuardService } from './subscription-guard.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { anonymizeLastName } from '../search/search.service.js';

// What the shortlist list returns per entry. The candidate summary is a lean,
// privacy-consistent subset (never the full profile entity): first name +
// anonymized last initial + headline, matching the CVthèque preview so the
// shortlist can't reveal more identity than the recruiter already saw.
export interface ShortlistEntryView {
  id: string;
  companyId: string;
  candidateProfileId: string;
  note: string | null;
  createdAt: Date;
  candidateProfile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    headline: string | null;
  } | null;
}

@Injectable()
export class ShortlistService {
  constructor(
    @InjectRepository(ShortlistEntry)
    private readonly shortlistRepo: Repository<ShortlistEntry>,
    @InjectRepository(CandidateProfile)
    private readonly profileRepo: Repository<CandidateProfile>,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly auditService: AuditService,
  ) {}

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

  async listEntries(callerId: string): Promise<ShortlistEntryView[]> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);
    const entries = await this.shortlistRepo.find({
      where: { companyId },
      // EF-RECR-06 — load the candidate so the list shows who was shortlisted
      // (the previous query returned only ids, so the UI rendered blanks).
      relations: { candidateProfile: true },
      order: { createdAt: 'DESC' },
    });
    return entries.map((e) => ({
      id: e.id,
      companyId: e.companyId,
      candidateProfileId: e.candidateProfileId,
      note: e.note,
      createdAt: e.createdAt,
      candidateProfile: e.candidateProfile
        ? {
            id: e.candidateProfile.id,
            firstName: e.candidateProfile.firstName,
            lastName: anonymizeLastName(e.candidateProfile.lastName),
            headline: e.candidateProfile.headline,
          }
        : null,
    }));
  }

  async removeEntry(callerId: string, entryId: string): Promise<void> {
    const companyId = await this.subscriptionGuard.resolveCompanyId(callerId);

    const entry = await this.shortlistRepo.findOne({
      where: { id: entryId, companyId },
    });
    if (!entry) {
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
