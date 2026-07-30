import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Company } from '../src/modules/companies/entities/company.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../src/modules/companies/entities/subscription.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

describe('subscriptions — UQ_subscriptions_company_active (e2e)', () => {
  let app: INestApplication;
  let companyRepo: Repository<Company>;
  let subscriptionRepo: Repository<Subscription>;

  let iceCounter = 0;
  function nextIce(): string {
    iceCounter += 1;
    return String(Date.now() + iceCounter)
      .padStart(15, '0')
      .slice(-15);
  }

  async function seedCompany(): Promise<string> {
    const company = await companyRepo.save(
      companyRepo.create({ name: 'Index Test Co', ice: nextIce() }),
    );
    return company.id;
  }

  function makeSubscription(
    companyId: string,
    status: SubscriptionStatus,
  ): Subscription {
    return subscriptionRepo.create({
      companyId,
      plan: SubscriptionPlan.STARTER,
      status,
      startsAt: new Date(),
      endsAt: null,
      contactQuota: 15,
      contactsUsed: 0,
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    companyRepo = app.get(getRepositoryToken(Company));
    subscriptionRepo = app.get(getRepositoryToken(Subscription));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a second ACTIVE subscription for the same company at the database level, not just in application code', async () => {
    const companyId = await seedCompany();
    await subscriptionRepo.save(
      makeSubscription(companyId, SubscriptionStatus.ACTIVE),
    );

    // Bypasses ContactQuotaService.resolveActiveSubscriptionId entirely —
    // this is a raw repository insert, proving the constraint itself
    // rejects the duplicate, not the application-level guard that sits in
    // front of it in normal request flow.
    let caught: unknown;
    try {
      await subscriptionRepo.save(
        makeSubscription(companyId, SubscriptionStatus.ACTIVE),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(QueryFailedError);
    expect((caught as QueryFailedError & { code?: string }).code).toBe(
      POSTGRES_UNIQUE_VIOLATION,
    );

    const rows = await subscriptionRepo.find({ where: { companyId } });
    expect(rows).toHaveLength(1);
  });

  it('rejects a TRIAL subscription when an ACTIVE one already exists for the same company (both sides of the partial index)', async () => {
    const companyId = await seedCompany();
    await subscriptionRepo.save(
      makeSubscription(companyId, SubscriptionStatus.ACTIVE),
    );

    let caught: unknown;
    try {
      await subscriptionRepo.save(
        makeSubscription(companyId, SubscriptionStatus.TRIAL),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(QueryFailedError);
    expect((caught as QueryFailedError & { code?: string }).code).toBe(
      POSTGRES_UNIQUE_VIOLATION,
    );
  });

  it('allows a CANCELLED subscription to coexist with an ACTIVE one for the same company (terminal statuses are excluded from the index)', async () => {
    const companyId = await seedCompany();
    await subscriptionRepo.save(
      makeSubscription(companyId, SubscriptionStatus.CANCELLED),
    );

    await expect(
      subscriptionRepo.save(
        makeSubscription(companyId, SubscriptionStatus.ACTIVE),
      ),
    ).resolves.toBeDefined();

    const rows = await subscriptionRepo.find({ where: { companyId } });
    expect(rows).toHaveLength(2);
  });

  it('allows two different companies to each have their own ACTIVE subscription', async () => {
    const companyIdA = await seedCompany();
    const companyIdB = await seedCompany();

    await expect(
      subscriptionRepo.save(
        makeSubscription(companyIdA, SubscriptionStatus.ACTIVE),
      ),
    ).resolves.toBeDefined();
    await expect(
      subscriptionRepo.save(
        makeSubscription(companyIdB, SubscriptionStatus.ACTIVE),
      ),
    ).resolves.toBeDefined();
  });
});
