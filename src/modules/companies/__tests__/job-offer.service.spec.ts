import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JobOfferService } from '../job-offer.service.js';
import { JobOffer, JobOfferStatus } from '../entities/job-offer.entity.js';
import { ModerationDecision } from '../dto/moderate-job-offer.dto.js';
import { SubscriptionGuardService } from '../subscription-guard.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { AuditAction } from '../../../common/enums/audit-action.enum.js';

describe('JobOfferService', () => {
  let service: JobOfferService;
  let jobOfferRepo: Record<string, jest.Mock>;
  let subscriptionGuard: Record<string, jest.Mock>;
  let auditService: Record<string, jest.Mock>;

  const callerId = 'recruiter-1';
  const companyId = 'company-1';

  function makeOffer(overrides: Record<string, unknown> = {}) {
    return {
      id: 'offer-1',
      companyId,
      createdBy: callerId,
      title: 'Backend engineer',
      status: JobOfferStatus.PENDING_MODERATION,
      moderatedBy: null,
      moderatedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    jobOfferRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => ({
        id: 'offer-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...e,
      })),
      save: jest
        .fn()
        .mockImplementation((e: Record<string, unknown>) => Promise.resolve(e)),
    };

    subscriptionGuard = {
      assertActiveSubscription: jest.fn().mockResolvedValue({ companyId }),
      resolveCompanyId: jest.fn().mockResolvedValue(companyId),
    };

    auditService = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobOfferService,
        { provide: getRepositoryToken(JobOffer), useValue: jobOfferRepo },
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(JobOfferService);
  });

  describe('EF-RECR-03 — Scenario 1: création (modération avant publication)', () => {
    it('creates an offer with status pending_moderation', async () => {
      const result = await service.createOffer(callerId, {
        title: 'Backend engineer',
      });

      expect(jobOfferRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          createdBy: callerId,
          status: JobOfferStatus.PENDING_MODERATION,
        }),
      );
      expect(result.status).toBe(JobOfferStatus.PENDING_MODERATION);
    });

    it('requires an active subscription', async () => {
      subscriptionGuard.assertActiveSubscription.mockRejectedValue(
        new ForbiddenException('inactive'),
      );

      await expect(
        service.createOffer(callerId, { title: 'Backend engineer' }),
      ).rejects.toThrow(ForbiddenException);
      expect(jobOfferRepo.save).not.toHaveBeenCalled();
    });

    it('logs JOB_OFFER_CREATED in audit', async () => {
      await service.createOffer(callerId, { title: 'Backend engineer' });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: callerId,
          action: AuditAction.JOB_OFFER_CREATED,
        }),
      );
    });
  });

  describe('EF-RECR-03 — Scenario 2: liste (isolation)', () => {
    it("returns only the caller's own company offers", async () => {
      await service.listOffers(callerId);

      expect(jobOfferRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId } }),
      );
    });
  });

  describe('EF-RECR-03 — Scenario 3: modération (admin/moderator)', () => {
    it('approves a pending offer to published', async () => {
      jobOfferRepo.findOne.mockResolvedValue(makeOffer());

      const result = await service.moderateOffer('moderator-1', 'offer-1', {
        decision: ModerationDecision.APPROVE,
      });

      expect(result.status).toBe(JobOfferStatus.PUBLISHED);
      expect(result.moderatedBy).toBe('moderator-1');
    });

    it('rejects a pending offer with a reason', async () => {
      jobOfferRepo.findOne.mockResolvedValue(makeOffer());

      const result = await service.moderateOffer('moderator-1', 'offer-1', {
        decision: ModerationDecision.REJECT,
        rejectionReason: 'Discriminatory wording',
      });

      expect(result.status).toBe(JobOfferStatus.REJECTED);
      expect(result.rejectionReason).toBe('Discriminatory wording');
    });

    it('rejects moderating an already-moderated offer (409)', async () => {
      jobOfferRepo.findOne.mockResolvedValue(
        makeOffer({ status: JobOfferStatus.PUBLISHED }),
      );

      await expect(
        service.moderateOffer('moderator-1', 'offer-1', {
          decision: ModerationDecision.APPROVE,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 404 when the offer does not exist', async () => {
      await expect(
        service.moderateOffer('moderator-1', 'nonexistent', {
          decision: ModerationDecision.APPROVE,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('EF-RECR-03 — Scenario 4: clôture (isolation)', () => {
    it('closes a published offer belonging to the caller company', async () => {
      jobOfferRepo.findOne.mockResolvedValue(
        makeOffer({ status: JobOfferStatus.PUBLISHED }),
      );

      const result = await service.closeOffer(callerId, 'offer-1');

      expect(result.status).toBe(JobOfferStatus.CLOSED);
    });

    it('queries the offer with id AND companyId in the same WHERE (not a separate JS check)', async () => {
      jobOfferRepo.findOne.mockResolvedValue(
        makeOffer({ status: JobOfferStatus.PUBLISHED }),
      );

      await service.closeOffer(callerId, 'offer-1');

      expect(jobOfferRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'offer-1', companyId } }),
      );
    });

    it('rejects closing a non-published offer (409)', async () => {
      jobOfferRepo.findOne.mockResolvedValue(makeOffer());

      await expect(service.closeOffer(callerId, 'offer-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it("rejects closing another company's offer with 404", async () => {
      // A row with this id exists under a different company. The combined
      // WHERE id+companyId means TypeORM itself returns no row for this
      // caller's companyId — the mock mirrors that by returning null.
      jobOfferRepo.findOne.mockResolvedValue(null);

      await expect(service.closeOffer(callerId, 'offer-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(jobOfferRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'offer-1', companyId } }),
      );
    });

    it('throws 404 when the caller has no company', async () => {
      subscriptionGuard.resolveCompanyId.mockRejectedValue(
        new NotFoundException('No company associated with this account'),
      );

      await expect(service.closeOffer(callerId, 'offer-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
