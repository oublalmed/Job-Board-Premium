import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactQuotaService } from '../contact-quota.service.js';
import {
  Subscription,
  SubscriptionStatus,
} from '../entities/subscription.entity.js';
import {
  ContactQuotaExceededException,
  MultipleActiveSubscriptionsException,
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

function activeSubscription(id: string): Record<string, unknown> {
  return {
    id,
    status: SubscriptionStatus.ACTIVE,
    endsAt: null,
  };
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
      find: jest.fn().mockResolvedValue([activeSubscription('sub-1')]),
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

  describe('Scenario 1 — une seule subscription active, quota disponible (régression nominale)', () => {
    it('resolves without throwing when the UPDATE affects a row', async () => {
      await expect(
        service.consumeOneContact(companyId),
      ).resolves.toBeUndefined();
    });

    it('resolves the active subscription id first, then runs the atomic UPDATE scoped to that id and the quota guard only', async () => {
      await service.consumeOneContact(companyId);

      expect(subscriptionRepo.find).toHaveBeenCalledTimes(1);

      expect(updateQb.set).toHaveBeenCalledWith({
        contactsUsed: expect.any(Function),
      });
      expect(updateQb.where).toHaveBeenCalledWith('id = :id', {
        id: 'sub-1',
      });
      expect(updateQb.andWhere).toHaveBeenCalledWith(
        'contacts_used < contact_quota',
      );
      // The WHERE must never target company_id directly — that's the bug
      // being fixed (company_id is not unique, id is).
      expect(updateQb.where).not.toHaveBeenCalledWith(
        expect.stringContaining('company_id'),
        expect.anything(),
      );

      // The increment itself must be a raw SQL fragment (atomic on the DB
      // side), not a value computed by reading contactsUsed beforehand.
      const setArg = updateQb.set.mock.calls[0][0] as {
        contactsUsed: () => string;
      };
      expect(setArg.contactsUsed()).toBe('contacts_used + 1');
    });
  });

  describe('Scenario 2 — quota épuisé (une seule subscription active, UPDATE ne matche aucune ligne)', () => {
    it('throws ContactQuotaExceededException and performs no diagnostic read', async () => {
      updateQb.execute.mockResolvedValue({ affected: 0 });

      await expect(service.consumeOneContact(companyId)).rejects.toThrow(
        ContactQuotaExceededException,
      );

      // resolveActiveSubscriptionId is the only read; no extra diagnostic
      // findOne is needed once affected === 0.
      expect(subscriptionRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 3 — aucune subscription active', () => {
    it('throws SubscriptionInactiveException and never issues the UPDATE', async () => {
      subscriptionRepo.find.mockResolvedValue([]);

      await expect(service.consumeOneContact(companyId)).rejects.toThrow(
        SubscriptionInactiveException,
      );

      expect(subscriptionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 4 — plusieurs subscriptions actives (violation d’invariant)', () => {
    it('throws MultipleActiveSubscriptionsException and never issues the UPDATE, so neither row is touched', async () => {
      subscriptionRepo.find.mockResolvedValue([
        activeSubscription('sub-1'),
        activeSubscription('sub-2'),
      ]);

      await expect(service.consumeOneContact(companyId)).rejects.toThrow(
        MultipleActiveSubscriptionsException,
      );

      expect(subscriptionRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(updateQb.execute).not.toHaveBeenCalled();
    });
  });
});
