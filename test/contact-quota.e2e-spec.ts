import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ContactQuotaService } from '../src/modules/companies/contact-quota.service';
import { ContactQuotaExceededException } from '../src/modules/companies/contact-quota.exceptions';
import { Company } from '../src/modules/companies/entities/company.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../src/modules/companies/entities/subscription.entity';

describe('ContactQuotaService (e2e) — atomic quota decrement', () => {
  let app: INestApplication;
  let contactQuotaService: ContactQuotaService;
  let companyRepo: Repository<Company>;
  let subscriptionRepo: Repository<Subscription>;

  let iceCounter = 0;
  function nextIce(): string {
    iceCounter += 1;
    return String(Date.now() + iceCounter)
      .padStart(15, '0')
      .slice(-15);
  }

  async function seedCompanyWithSubscription(
    contactQuota: number,
    contactsUsed: number,
  ): Promise<{ companyId: string; subscriptionId: string }> {
    const company = await companyRepo.save(
      companyRepo.create({ name: 'Quota Test Co', ice: nextIce() }),
    );
    const subscription = await subscriptionRepo.save(
      subscriptionRepo.create({
        companyId: company.id,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
        startsAt: new Date(),
        endsAt: null,
        contactQuota,
        contactsUsed,
      }),
    );
    return { companyId: company.id, subscriptionId: subscription.id };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    contactQuotaService = app.get(ContactQuotaService);
    companyRepo = app.get(getRepositoryToken(Company));
    subscriptionRepo = app.get(getRepositoryToken(Subscription));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a single call succeed when quota is available', async () => {
    const { companyId, subscriptionId } = await seedCompanyWithSubscription(
      5,
      2,
    );

    await contactQuotaService.consumeOneContact(companyId);

    const subscription = await subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    expect(subscription?.contactsUsed).toBe(3);
  });

  it('rejects when the quota is already exhausted, without writing', async () => {
    const { companyId, subscriptionId } = await seedCompanyWithSubscription(
      5,
      5,
    );

    await expect(
      contactQuotaService.consumeOneContact(companyId),
    ).rejects.toThrow(ContactQuotaExceededException);

    const subscription = await subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    expect(subscription?.contactsUsed).toBe(5);
  });

  describe('Concurrency — the test that proves atomicity', () => {
    it('with exactly one contact remaining, two parallel calls yield exactly one success and one ContactQuotaExceededException, and the final quota_used is correct (not double-decremented, not skipped)', async () => {
      const { companyId, subscriptionId } = await seedCompanyWithSubscription(
        5,
        4, // exactly 1 remaining
      );

      const results = await Promise.allSettled([
        contactQuotaService.consumeOneContact(companyId),
        contactQuotaService.consumeOneContact(companyId),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ContactQuotaExceededException);

      const subscription = await subscriptionRepo.findOne({
        where: { id: subscriptionId },
      });
      // Proof of atomicity: exactly one increment landed, never two (which
      // would silently blow past the quota) and never zero (which would
      // mean the successful call's write was lost).
      expect(subscription?.contactsUsed).toBe(5);
    });
  });
});
