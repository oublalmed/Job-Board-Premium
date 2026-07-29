import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactQuotaService } from '../contact-quota.service.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../entities/subscription.entity.js';
import {
  ContactQuotaExceededException,
  SubscriptionInactiveException,
} from '../contact-quota.exceptions.js';

function createMockUpdateQueryBuilder(
  affected: number,
): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['update', 'set', 'where', 'andWhere']) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.execute = jest.fn().mockResolvedValue({ affected });
  return qb;
}

describe('ContactQuotaService', () => {
  let service: ContactQuotaService;
  let subscriptionRepo: Record<string, jest.Mock>;
  let updateQb: Record<string, jest.Mock>;

  const companyId = 'company-1';

  beforeEach(async () => {
    updateQb = createMockUpdateQueryBuilder(1);
    subscriptionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(updateQb),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactQuotaService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepo,
        },
      ],
    }).compile();

    service = module.get(ContactQuotaService);
  });

  describe('Scenario 1 — quota disponible', () => {
    it('resolves without throwing when the UPDATE affects a row', async () => {
      await expect(
        service.consumeOneContact(companyId),
      ).resolves.toBeUndefined();

      expect(subscriptionRepo.findOne).not.toHaveBeenCalled();
    });

    it('issues a single atomic UPDATE with the increment, company scope, active statuses and quota guard', async () => {
      await service.consumeOneContact(companyId);

      expect(updateQb.set).toHaveBeenCalledWith({
        contactsUsed: expect.any(Function),
      });
      expect(updateQb.where).toHaveBeenCalledWith('company_id = :companyId', {
        companyId,
      });
      expect(updateQb.andWhere).toHaveBeenCalledWith(
        'status IN (:...statuses)',
        { statuses: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] },
      );
      expect(updateQb.andWhere).toHaveBeenCalledWith(
        'contacts_used < contact_quota',
      );

      // The increment itself must be a raw SQL fragment (atomic on the DB
      // side), not a value computed by reading contactsUsed beforehand.
      const setArg = updateQb.set.mock.calls[0][0] as {
        contactsUsed: () => string;
      };
      expect(setArg.contactsUsed()).toBe('contacts_used + 1');
    });
  });

  describe('Scenario 2 — quota épuisé (quota_used === contact_quota)', () => {
    it('throws ContactQuotaExceededException and performs no write', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        endsAt: null,
      });

      await expect(service.consumeOneContact(companyId)).rejects.toThrow(
        ContactQuotaExceededException,
      );
    });
  });

  describe('Scenario 3 — abonnement inactif', () => {
    it('throws SubscriptionInactiveException when there is no subscription at all', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.consumeOneContact(companyId)).rejects.toThrow(
        SubscriptionInactiveException,
      );
    });

    it('throws SubscriptionInactiveException when the subscription is cancelled', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.CANCELLED,
        endsAt: null,
      });

      await expect(service.consumeOneContact(companyId)).rejects.toThrow(
        SubscriptionInactiveException,
      );
    });

    it('throws SubscriptionInactiveException when the trial has expired', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });
      subscriptionRepo.findOne.mockResolvedValue({
        status: SubscriptionStatus.TRIAL,
        endsAt: new Date(Date.now() - 3600000),
      });

      await expect(service.consumeOneContact(companyId)).rejects.toThrow(
        SubscriptionInactiveException,
      );
    });
  });
});
