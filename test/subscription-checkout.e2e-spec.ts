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
  });

  afterEach(() => {
    createCheckoutSpy.mockClear();
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
});
