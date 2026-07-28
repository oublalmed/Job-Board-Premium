import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ShortlistService } from '../shortlist.service.js';
import { ShortlistEntry } from '../entities/shortlist-entry.entity.js';
import { Recruiter } from '../entities/recruiter.entity.js';
import {
  CandidateProfile,
  ProfileVisibility,
} from '../../candidates/entities/candidate-profile.entity.js';
import { SubscriptionGuardService } from '../subscription-guard.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

describe('ShortlistService', () => {
  let service: ShortlistService;
  let shortlistRepo: Record<string, jest.Mock>;
  let recruiterRepo: Record<string, jest.Mock>;
  let profileRepo: Record<string, jest.Mock>;
  let subscriptionGuard: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const callerId = 'recruiter-1';
  const companyId = 'company-1';
  const candidateProfileId = 'profile-1';

  const visibleIndexedProfile = {
    id: candidateProfileId,
    indexedInCvtheque: true,
    visibility: ProfileVisibility.PUBLIC,
  };

  beforeEach(async () => {
    shortlistRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'entry-1',
        createdAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    recruiterRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'recruiter-1', userId: callerId, companyId }),
    };

    profileRepo = {
      findOne: jest.fn().mockResolvedValue({ ...visibleIndexedProfile }),
    };

    subscriptionGuard = {
      assertActiveSubscription: jest.fn().mockResolvedValue({ companyId }),
    };

    auditService = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShortlistService,
        {
          provide: getRepositoryToken(ShortlistEntry),
          useValue: shortlistRepo,
        },
        { provide: getRepositoryToken(Recruiter), useValue: recruiterRepo },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: profileRepo,
        },
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(ShortlistService);
  });

  describe('EF-RECR-06 — Scenario 1: ajout nominal', () => {
    it('adds a visible, indexed candidate profile to the shortlist', async () => {
      const result = await service.addEntry(callerId, { candidateProfileId });

      expect(shortlistRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          candidateProfileId,
          addedBy: callerId,
        }),
      );
      expect(result.id).toBe('entry-1');
    });

    it('requires an active subscription', async () => {
      subscriptionGuard.assertActiveSubscription.mockRejectedValue(
        new ForbiddenException('inactive'),
      );

      await expect(
        service.addEntry(callerId, { candidateProfileId }),
      ).rejects.toThrow(ForbiddenException);
      expect(shortlistRepo.save).not.toHaveBeenCalled();
    });

    it('logs SHORTLIST_ENTRY_ADDED in audit', async () => {
      await service.addEntry(callerId, { candidateProfileId });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: callerId,
          action: AuditAction.SHORTLIST_ENTRY_ADDED,
        }),
      );
    });
  });

  describe('EF-RECR-06 — Scenario 2: erreurs ajout', () => {
    it('rejects 404 when the candidate profile does not exist', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addEntry(callerId, { candidateProfileId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects 404 when the candidate profile is hidden', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...visibleIndexedProfile,
        visibility: ProfileVisibility.HIDDEN,
      });

      await expect(
        service.addEntry(callerId, { candidateProfileId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects 404 when the candidate profile is not indexed', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...visibleIndexedProfile,
        indexedInCvtheque: false,
      });

      await expect(
        service.addEntry(callerId, { candidateProfileId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects 409 when the candidate is already shortlisted', async () => {
      shortlistRepo.findOne.mockResolvedValue({ id: 'existing-entry' });

      await expect(
        service.addEntry(callerId, { candidateProfileId }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('EF-RECR-06 — Scenario 3: liste et retrait (isolation)', () => {
    it('lists only the caller company shortlist', async () => {
      await service.listEntries(callerId);

      expect(shortlistRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId } }),
      );
    });

    it('removes an entry belonging to the caller company', async () => {
      shortlistRepo.findOne.mockResolvedValue({ id: 'entry-1', companyId });

      await service.removeEntry(callerId, 'entry-1');

      expect(shortlistRepo.delete).toHaveBeenCalledWith({ id: 'entry-1' });
    });

    it("rejects removing another company's entry with 404", async () => {
      shortlistRepo.findOne.mockResolvedValue({
        id: 'entry-1',
        companyId: 'other-company',
      });

      await expect(service.removeEntry(callerId, 'entry-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(shortlistRepo.delete).not.toHaveBeenCalled();
    });
  });
});
