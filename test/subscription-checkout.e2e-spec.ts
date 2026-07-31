import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../src/modules/companies/entities/subscription.entity';
import { Role } from '../src/common/enums/role.enum';
import { PAYMENT_PROVIDER } from '../src/ports/payment.port';
import type { PaymentProvider } from '../src/ports/payment.port';

describe('Subscription checkout (e2e) — Lot 6B', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let subscriptionRepo: Repository<Subscription>;
  let createCheckoutSpy: jest.SpiedFunction<
    PaymentProvider['createCheckoutSession']
  >;
  let cancelAtPeriodEndSpy: jest.SpiedFunction<
    PaymentProvider['cancelAtPeriodEnd']
  >;
  let changeSubscriptionPlanSpy: jest.SpiedFunction<
    PaymentProvider['changeSubscriptionPlan']
  >;

  let iceCounter = 0;
  function nextIce(): string {
    iceCounter += 1;
    return String(Date.now() + iceCounter)
      .padStart(15, '0')
      .slice(-15);
  }

  let emailCounter = 0;
  async function createVerifiedUser(
    roles: Role[] = [Role.RECRUITER],
  ): Promise<{ userId: string; email: string; token: string }> {
    emailCounter += 1;
    const email = `e2e-checkout-${Date.now()}-${emailCounter}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        passwordHash: 'irrelevant-for-this-test',
        roles,
        emailVerified: true,
      }),
    );
    const token = jwtService.sign({ sub: user.id, email, roles: user.roles });
    return { userId: user.id, email, token };
  }

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  async function createCompanyFor(
    token: string,
    name = 'Acme Corp',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(path('/companies'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name, ice: nextIce() })
      .expect(201);
    return (res.body as { company: { id: string } }).company.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const configService = app.get(ConfigService);
    apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
    app.setGlobalPrefix(apiPrefix);

    await app.init();

    jwtService = app.get(JwtService);
    userRepo = app.get(getRepositoryToken(User));
    subscriptionRepo = app.get(getRepositoryToken(Subscription));

    // Checkout Session creation is a real outbound Stripe API call — no
    // network/live credentials in this environment. Only this one method
    // is spied on the REAL, DI-resolved StripePaymentProvider instance;
    // verifyAndParseWebhook (tested in payment-webhook.e2e-spec.ts and
    // stripe-payment.adapter.spec.ts) is never touched here.
    const paymentProvider = app.get<PaymentProvider>(PAYMENT_PROVIDER);
    createCheckoutSpy = jest
      .spyOn(paymentProvider, 'createCheckoutSession')
      .mockResolvedValue({
        url: 'https://checkout.stripe.com/test/fake-session',
        providerSessionId: 'cs_fake',
      });
    // Same reasoning as createCheckoutSession above — cancelAtPeriodEnd
    // (Lot 6D commit 3) is a real outbound Stripe API call too.
    cancelAtPeriodEndSpy = jest
      .spyOn(paymentProvider, 'cancelAtPeriodEnd')
      .mockResolvedValue(undefined);
    // changeSubscriptionPlan (Lot 6D commit 4) is also a real outbound
    // Stripe API call — same reasoning.
    changeSubscriptionPlanSpy = jest
      .spyOn(paymentProvider, 'changeSubscriptionPlan')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    createCheckoutSpy.mockClear();
    cancelAtPeriodEndSpy.mockClear();
    changeSubscriptionPlanSpy.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scénario 5 — pas d’activation par le retour client', () => {
    it('creating a checkout session never changes the subscription row itself', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);

      const before = await subscriptionRepo.findOne({ where: { companyId } });
      expect(before?.status).toBe(SubscriptionStatus.TRIAL);

      const res = await request(app.getHttpServer())
        .post(path('/subscriptions'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          plan: SubscriptionPlan.GROWTH,
          successUrl: 'https://app.local/billing/success',
          cancelUrl: 'https://app.local/billing/cancel',
        })
        .expect(201);

      expect((res.body as { url: string }).url).toBe(
        'https://checkout.stripe.com/test/fake-session',
      );

      const after = await subscriptionRepo.findOne({ where: { companyId } });
      expect(after?.status).toBe(SubscriptionStatus.TRIAL); // unchanged
      expect(after?.plan).toBe(before?.plan);
      expect(after?.externalSubscriptionId).toBeNull();
      expect(after?.updatedAt).toEqual(before?.updatedAt);
    });

    it('rejects a second checkout while a subscription is already ACTIVE, without touching it', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      subscription.status = SubscriptionStatus.ACTIVE;
      await subscriptionRepo.save(subscription);

      await request(app.getHttpServer())
        .post(path('/subscriptions'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          plan: SubscriptionPlan.GROWTH,
          successUrl: 'https://app.local/billing/success',
          cancelUrl: 'https://app.local/billing/cancel',
        })
        .expect(403);

      const after = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      expect(after.updatedAt).toEqual(subscription.updatedAt);
    });
  });

  describe('Scénario 6 — isolation ADR-0001 sur la création de session', () => {
    it('resolves companyId server-side from the caller, never from the request body', async () => {
      const recruiterA = await createVerifiedUser();
      const companyIdA = await createCompanyFor(recruiterA.token, 'Company A');
      const recruiterB = await createVerifiedUser();
      const companyIdB = await createCompanyFor(recruiterB.token, 'Company B');

      await request(app.getHttpServer())
        .post(path('/subscriptions'))
        .set('Authorization', `Bearer ${recruiterA.token}`)
        .send({
          plan: SubscriptionPlan.STARTER,
          successUrl: 'https://app.local/billing/success',
          cancelUrl: 'https://app.local/billing/cancel',
        })
        .expect(201);

      expect(createCheckoutSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ companyId: companyIdA }),
      );

      await request(app.getHttpServer())
        .post(path('/subscriptions'))
        .set('Authorization', `Bearer ${recruiterB.token}`)
        .send({
          plan: SubscriptionPlan.STARTER,
          successUrl: 'https://app.local/billing/success',
          cancelUrl: 'https://app.local/billing/cancel',
        })
        .expect(201);

      expect(createCheckoutSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ companyId: companyIdB }),
      );
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(path('/subscriptions'))
        .send({
          plan: SubscriptionPlan.STARTER,
          successUrl: 'https://app.local/billing/success',
          cancelUrl: 'https://app.local/billing/cancel',
        })
        .expect(401);
    });

    it('rejects a candidate (wrong role) even if authenticated', async () => {
      const candidate = await createVerifiedUser([Role.CANDIDATE]);

      await request(app.getHttpServer())
        .post(path('/subscriptions'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({
          plan: SubscriptionPlan.STARTER,
          successUrl: 'https://app.local/billing/success',
          cancelUrl: 'https://app.local/billing/cancel',
        })
        .expect(403);
    });

    it('rejects a client-supplied companyId in the request body outright (DTO has no such field)', async () => {
      const recruiter = await createVerifiedUser();
      await createCompanyFor(recruiter.token);
      const otherRecruiter = await createVerifiedUser();
      const otherCompanyId = await createCompanyFor(
        otherRecruiter.token,
        'Other Co',
      );

      await request(app.getHttpServer())
        .post(path('/subscriptions'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          companyId: otherCompanyId, // not a CreateSubscriptionDto field
          plan: SubscriptionPlan.STARTER,
          successUrl: 'https://app.local/billing/success',
          cancelUrl: 'https://app.local/billing/cancel',
        })
        .expect(400); // forbidNonWhitelisted rejects the unknown field

      expect(createCheckoutSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ companyId: otherCompanyId }),
      );
    });
  });

  describe('Scénario 7 — résiliation avec accès maintenu jusqu’à periodEnd (Lot 6D)', () => {
    it('sets cancelAtPeriodEnd and keeps the subscription ACTIVE — access is maintained', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.externalSubscriptionId = 'sub_cancel_e2e_1';
      subscription.endsAt = new Date('2026-08-20T00:00:00.000Z');
      await subscriptionRepo.save(subscription);

      const res = await request(app.getHttpServer())
        .post(path('/subscriptions/cancel'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({})
        .expect(201);

      expect(res.body).toEqual({
        cancelAtPeriodEnd: true,
        periodEnd: '2026-08-20T00:00:00.000Z',
      });
      expect(cancelAtPeriodEndSpy).toHaveBeenCalledWith('sub_cancel_e2e_1');

      const after = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      expect(after.status).toBe(SubscriptionStatus.ACTIVE); // unchanged
      expect(after.cancelAtPeriodEnd).toBe(true);

      // Access maintained: a subscription-gated action still succeeds.
      await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ title: 'Ingénieur logiciel' })
        .expect(201);
    });

    it('is idempotent — a second call does not re-invoke the provider', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.externalSubscriptionId = 'sub_cancel_e2e_2';
      await subscriptionRepo.save(subscription);

      await request(app.getHttpServer())
        .post(path('/subscriptions/cancel'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({})
        .expect(201);
      expect(cancelAtPeriodEndSpy).toHaveBeenCalledTimes(1);

      await request(app.getHttpServer())
        .post(path('/subscriptions/cancel'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({})
        .expect(201);
      expect(cancelAtPeriodEndSpy).toHaveBeenCalledTimes(1); // not called again
    });

    it('resolves companyId server-side (ADR-0001) — cancelling only ever touches the caller’s own company', async () => {
      const recruiterA = await createVerifiedUser();
      const companyIdA = await createCompanyFor(recruiterA.token, 'Company A');
      const subA = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdA },
      });
      subA.status = SubscriptionStatus.ACTIVE;
      subA.externalSubscriptionId = 'sub_a';
      await subscriptionRepo.save(subA);

      const recruiterB = await createVerifiedUser();
      const companyIdB = await createCompanyFor(recruiterB.token, 'Company B');
      const subB = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdB },
      });
      subB.status = SubscriptionStatus.ACTIVE;
      subB.externalSubscriptionId = 'sub_b';
      await subscriptionRepo.save(subB);

      await request(app.getHttpServer())
        .post(path('/subscriptions/cancel'))
        .set('Authorization', `Bearer ${recruiterA.token}`)
        .send({})
        .expect(201);

      expect(cancelAtPeriodEndSpy).toHaveBeenLastCalledWith('sub_a');

      const afterA = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdA },
      });
      const afterB = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdB },
      });
      expect(afterA.cancelAtPeriodEnd).toBe(true);
      expect(afterB.cancelAtPeriodEnd).toBe(false); // company B untouched
    });

    it('rejects when the company has no ACTIVE/PAST_DUE subscription (still TRIAL)', async () => {
      const recruiter = await createVerifiedUser();
      await createCompanyFor(recruiter.token); // fresh company is TRIAL only

      await request(app.getHttpServer())
        .post(path('/subscriptions/cancel'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({})
        .expect(404);

      expect(cancelAtPeriodEndSpy).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(path('/subscriptions/cancel'))
        .send({})
        .expect(401);
    });
  });

  describe('Scénario 8 — fenêtre de grâce PAST_DUE (Lot 6D)', () => {
    it('access maintained for PAST_DUE within the grace window, restricted once past it', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      subscription.status = SubscriptionStatus.PAST_DUE;
      subscription.pastDueSince = new Date(); // just went past due
      await subscriptionRepo.save(subscription);

      await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ title: 'Dans la fenêtre de grâce' })
        .expect(201);

      // SUBSCRIPTION_GRACE_PERIOD_DAYS=7 in this environment's .env — well
      // outside it.
      subscription.pastDueSince = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      );
      await subscriptionRepo.save(subscription);

      await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ title: 'Hors de la fenêtre de grâce' })
        .expect(403);
    });
  });

  describe('Scénario 9 — changement de plan avec prorata (Lot 6D)', () => {
    it('upgrade: applies the change at Stripe and reajusts quota immediately, preserving contactsUsed', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.plan = SubscriptionPlan.GROWTH;
      subscription.externalSubscriptionId = 'sub_plan_e2e_1';
      subscription.contactQuota = 60;
      subscription.contactsUsed = 45;
      await subscriptionRepo.save(subscription);

      const res = await request(app.getHttpServer())
        .post(path('/subscriptions/plan'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ plan: SubscriptionPlan.SCALE })
        .expect(201);

      expect(res.body).toEqual({
        plan: SubscriptionPlan.SCALE,
        contactQuota: 200,
        contactsUsed: 45,
      });
      expect(changeSubscriptionPlanSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          providerSubscriptionId: 'sub_plan_e2e_1',
          plan: SubscriptionPlan.SCALE,
          amount: 828000, // scale TTC
        }),
      );

      const after = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      expect(after.plan).toBe(SubscriptionPlan.SCALE);
      expect(after.contactQuota).toBe(200);
      expect(after.contactsUsed).toBe(45); // preserved immediately, not reset
      expect(after.status).toBe(SubscriptionStatus.ACTIVE); // unchanged
    });

    it('downgrade: caps naturally via ContactQuotaService — no special-casing needed', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.plan = SubscriptionPlan.SCALE;
      subscription.externalSubscriptionId = 'sub_plan_e2e_2';
      subscription.contactQuota = 200;
      subscription.contactsUsed = 80; // above starter's quota of 15
      await subscriptionRepo.save(subscription);

      const res = await request(app.getHttpServer())
        .post(path('/subscriptions/plan'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ plan: SubscriptionPlan.STARTER })
        .expect(201);

      expect(res.body).toEqual({
        plan: SubscriptionPlan.STARTER,
        contactQuota: 15,
        contactsUsed: 80,
      });

      const after = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      expect(after.contactQuota).toBe(15);
      expect(after.contactsUsed).toBe(80); // not clamped — capped by the
      // atomic guard elsewhere (WHERE contacts_used < contact_quota) the
      // next time a contact reveal is attempted, not retroactively here.
    });

    it('rejects a request for the plan already in effect', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.plan = SubscriptionPlan.GROWTH;
      subscription.externalSubscriptionId = 'sub_plan_e2e_3';
      await subscriptionRepo.save(subscription);

      await request(app.getHttpServer())
        .post(path('/subscriptions/plan'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ plan: SubscriptionPlan.GROWTH })
        .expect(400);

      expect(changeSubscriptionPlanSpy).not.toHaveBeenCalled();
    });

    it('resolves companyId server-side (ADR-0001) — changing plan only ever touches the caller’s own company', async () => {
      const recruiterA = await createVerifiedUser();
      const companyIdA = await createCompanyFor(recruiterA.token, 'Company A');
      const subA = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdA },
      });
      subA.status = SubscriptionStatus.ACTIVE;
      subA.plan = SubscriptionPlan.GROWTH;
      subA.externalSubscriptionId = 'sub_plan_a';
      await subscriptionRepo.save(subA);

      const recruiterB = await createVerifiedUser();
      const companyIdB = await createCompanyFor(recruiterB.token, 'Company B');
      const subB = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdB },
      });
      subB.status = SubscriptionStatus.ACTIVE;
      subB.plan = SubscriptionPlan.GROWTH;
      subB.externalSubscriptionId = 'sub_plan_b';
      await subscriptionRepo.save(subB);

      await request(app.getHttpServer())
        .post(path('/subscriptions/plan'))
        .set('Authorization', `Bearer ${recruiterA.token}`)
        .send({ plan: SubscriptionPlan.SCALE })
        .expect(201);

      expect(changeSubscriptionPlanSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ providerSubscriptionId: 'sub_plan_a' }),
      );

      const afterA = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdA },
      });
      const afterB = await subscriptionRepo.findOneOrFail({
        where: { companyId: companyIdB },
      });
      expect(afterA.plan).toBe(SubscriptionPlan.SCALE);
      expect(afterB.plan).toBe(SubscriptionPlan.GROWTH); // company B untouched
    });

    it('rejects when the company has no ACTIVE/PAST_DUE subscription (still TRIAL)', async () => {
      const recruiter = await createVerifiedUser();
      await createCompanyFor(recruiter.token); // fresh company is TRIAL only

      await request(app.getHttpServer())
        .post(path('/subscriptions/plan'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ plan: SubscriptionPlan.SCALE })
        .expect(404);

      expect(changeSubscriptionPlanSpy).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(path('/subscriptions/plan'))
        .send({ plan: SubscriptionPlan.SCALE })
        .expect(401);
    });
  });
});
