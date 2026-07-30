import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../src/modules/companies/entities/subscription.entity';
import { ProcessedWebhookEvent } from '../src/modules/billing/entities/processed-webhook-event.entity';
import { PaymentWebhookService } from '../src/modules/billing/payment-webhook.service';
import { Role } from '../src/common/enums/role.enum';

describe('Payment webhook (e2e) — Lot 6B', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let subscriptionRepo: Repository<Subscription>;
  let processedEventRepo: Repository<ProcessedWebhookEvent>;
  let webhookService: PaymentWebhookService;
  let webhookSecret: string;

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
    const email = `e2e-webhook-${Date.now()}-${emailCounter}@example.com`;
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

  function checkoutSessionCompletedPayload(
    companyId: string,
    plan: SubscriptionPlan,
    eventId: string,
  ): string {
    return JSON.stringify({
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_${eventId}`,
          subscription: `sub_${eventId}`,
          metadata: { companyId, plan },
        },
      },
    });
  }

  function checkoutSessionExpiredPayload(
    companyId: string,
    eventId: string,
  ): string {
    return JSON.stringify({
      id: eventId,
      type: 'checkout.session.expired',
      data: {
        object: { id: `cs_${eventId}`, metadata: { companyId } },
      },
    });
  }

  // This SDK's Invoice shape nests the subscription reference under
  // invoice.parent.subscription_details.subscription — see
  // stripe-payment.adapter.ts's extractSubscriptionId comment.
  function invoicePaidPayload(
    billingReason: string,
    eventId: string,
    providerSubscriptionId: string,
  ): string {
    return JSON.stringify({
      id: eventId,
      type: 'invoice.paid',
      data: {
        object: {
          id: `in_${eventId}`,
          billing_reason: billingReason,
          parent: {
            subscription_details: { subscription: providerSubscriptionId },
          },
        },
      },
    });
  }

  function sign(payload: string): string {
    return Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
  }

  let eventCounter = 0;
  function nextEventId(): string {
    eventCounter += 1;
    return `evt_e2e_${Date.now()}_${eventCounter}`;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
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
    webhookSecret = configService.get<string>('payment.stripeWebhookSecret', '');

    await app.init();

    jwtService = app.get(JwtService);
    userRepo = app.get(getRepositoryToken(User));
    subscriptionRepo = app.get(getRepositoryToken(Subscription));
    processedEventRepo = app.get(getRepositoryToken(ProcessedWebhookEvent));
    webhookService = app.get(PaymentWebhookService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scénario 1 — signature invalide', () => {
    it('rejects with 400 and leaves no trace in processed_webhook_events', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const eventId = nextEventId();
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        eventId,
      );

      await request(app.getHttpServer())
        .post(path('/webhooks/payment'))
        .set('stripe-signature', 't=1,v1=not-a-real-signature')
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(400);

      const recorded = await processedEventRepo.findOne({
        where: { providerEventId: eventId },
      });
      expect(recorded).toBeNull();

      const subscription = await subscriptionRepo.findOne({
        where: { companyId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.TRIAL);
    });
  });

  describe('Scénario 2 — idempotence (livraison identique 2x)', () => {
    it('activates once; the second delivery is 200 with no further effect', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const eventId = nextEventId();
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        eventId,
      );
      const signature = sign(payload);

      const first = await webhookService.handleWebhook(
        Buffer.from(payload),
        signature,
      );
      expect(first.alreadyProcessed).toBe(false);

      const afterFirst = await subscriptionRepo.findOne({
        where: { companyId },
      });
      expect(afterFirst?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(afterFirst?.contactQuota).toBe(60); // growth
      expect(afterFirst?.contactsUsed).toBe(0);

      const second = await webhookService.handleWebhook(
        Buffer.from(payload),
        signature,
      );
      expect(second.alreadyProcessed).toBe(true);

      const afterSecond = await subscriptionRepo.findOne({
        where: { companyId },
      });
      // Unchanged by the replay — same row, same values, not reprovisioned.
      expect(afterSecond?.id).toBe(afterFirst?.id);
      expect(afterSecond?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(afterSecond?.contactQuota).toBe(60);
      expect(afterSecond?.contactsUsed).toBe(0);

      const rows = await processedEventRepo.find({
        where: { providerEventId: eventId },
      });
      expect(rows).toHaveLength(1);
    });
  });

  describe('Scénario 3 — activation nominale', () => {
    it('checkout.session.completed activates the subscription and provisions the right plan quota', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.SCALE,
        nextEventId(),
      );
      const signature = sign(payload);

      const res = await request(app.getHttpServer())
        .post(path('/webhooks/payment'))
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(200);

      expect((res.body as { alreadyProcessed: boolean }).alreadyProcessed).toBe(
        false,
      );

      const subscription = await subscriptionRepo.findOne({
        where: { companyId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription?.plan).toBe(SubscriptionPlan.SCALE);
      expect(subscription?.contactQuota).toBe(200); // scale
      expect(subscription?.contactsUsed).toBe(0);
    });

    it('checkout.session.expired demotes an ACTIVE subscription to PAST_DUE', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const activatePayload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.STARTER,
        nextEventId(),
      );
      await webhookService.handleWebhook(
        Buffer.from(activatePayload),
        sign(activatePayload),
      );

      const failPayload = checkoutSessionExpiredPayload(
        companyId,
        nextEventId(),
      );
      await webhookService.handleWebhook(
        Buffer.from(failPayload),
        sign(failPayload),
      );

      const subscription = await subscriptionRepo.findOne({
        where: { companyId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.PAST_DUE);
    });
  });

  describe('Scénario 4 — concurrence (2 livraisons parallèles du même event)', () => {
    it('yields exactly one activation and one quota provisioning', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        nextEventId(),
      );
      const signature = sign(payload);

      const results = await Promise.allSettled([
        webhookService.handleWebhook(Buffer.from(payload), signature),
        webhookService.handleWebhook(Buffer.from(payload), signature),
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      const outcomes = results
        .filter(
          (r): r is PromiseFulfilledResult<{ alreadyProcessed: boolean }> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value.alreadyProcessed);
      expect(outcomes.sort()).toEqual([false, true]);

      const subscription = await subscriptionRepo.findOne({
        where: { companyId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription?.contactQuota).toBe(60);
      expect(subscription?.contactsUsed).toBe(0);

      const rows = await subscriptionRepo.find({ where: { companyId } });
      expect(rows).toHaveLength(1); // no duplicate row created by the race
    });
  });

  describe('Scénario 5 — discrimination du 23505 (pas tout conflit unique = déjà traité)', () => {
    it('a 23505 on UQ_subscriptions_company_active (not the dedup marker) is NOT swallowed as alreadyProcessed — it surfaces as a real error', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);

      // Simulates a company that already has a real ACTIVE subscription
      // (e.g. activated by a prior, legitimate event) so that a NEW
      // checkout.session.completed for the same company — with no eligible
      // TRIAL/PAST_DUE row to reuse — takes activateSubscription's
      // "insert fresh" branch and collides for real with Lot 6A's
      // UQ_subscriptions_company_active, not with the dedup marker.
      const existing = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      existing.status = SubscriptionStatus.ACTIVE;
      await subscriptionRepo.save(existing);

      const conflictingPayload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        nextEventId(), // a genuinely new event id — not a replay
      );
      const signature = sign(conflictingPayload);

      const res = await request(app.getHttpServer())
        .post(path('/webhooks/payment'))
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(conflictingPayload);

      // Not a 2xx: this must NOT look like success to Stripe. The exact
      // code depends on GlobalExceptionFilter's handling of an unhandled
      // QueryFailedError, but it must not be in the 2xx range.
      expect(res.status).toBeGreaterThanOrEqual(400);

      // The whole transaction rolled back — including the dedup marker
      // insert that ran before the conflict was hit — so no phantom
      // "processed" row is left behind for an event that actually failed.
      const rows = await subscriptionRepo.find({ where: { companyId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(existing.id);
      expect(rows[0].status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('Scénario 6 — renouvellement récurrent (Lot 6D)', () => {
    it('extends endsAt by one billing period and resets contactsUsed on invoice.paid (subscription_cycle)', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const activateEventId = nextEventId();
      const activatePayload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        activateEventId,
      );
      await webhookService.handleWebhook(
        Buffer.from(activatePayload),
        sign(activatePayload),
      );

      const beforeRenewal = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      expect(beforeRenewal.externalSubscriptionId).toBe(
        `sub_${activateEventId}`,
      );

      // Consume some quota before renewal, to prove the reset actually
      // happens (not just already zero).
      beforeRenewal.contactsUsed = 12;
      await subscriptionRepo.save(beforeRenewal);

      const renewEventId = nextEventId();
      const renewPayload = invoicePaidPayload(
        'subscription_cycle',
        renewEventId,
        beforeRenewal.externalSubscriptionId!,
      );

      const res = await request(app.getHttpServer())
        .post(path('/webhooks/payment'))
        .set('stripe-signature', sign(renewPayload))
        .set('Content-Type', 'application/json')
        .send(renewPayload)
        .expect(200);
      expect((res.body as { alreadyProcessed: boolean }).alreadyProcessed).toBe(
        false,
      );

      const afterRenewal = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      expect(afterRenewal.status).toBe(SubscriptionStatus.ACTIVE);
      expect(afterRenewal.contactsUsed).toBe(0);
      expect(afterRenewal.endsAt!.getTime()).toBeGreaterThan(
        beforeRenewal.endsAt!.getTime(),
      );
    });

    it('is idempotent on replay — one prolongation, endsAt unchanged by the second delivery', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const activateEventId = nextEventId();
      const activatePayload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        activateEventId,
      );
      await webhookService.handleWebhook(
        Buffer.from(activatePayload),
        sign(activatePayload),
      );
      const subscription = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });

      const renewEventId = nextEventId();
      const renewPayload = invoicePaidPayload(
        'subscription_cycle',
        renewEventId,
        subscription.externalSubscriptionId!,
      );
      const signature = sign(renewPayload);

      const first = await webhookService.handleWebhook(
        Buffer.from(renewPayload),
        signature,
      );
      expect(first.alreadyProcessed).toBe(false);
      const afterFirst = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });

      const second = await webhookService.handleWebhook(
        Buffer.from(renewPayload),
        signature,
      );
      expect(second.alreadyProcessed).toBe(true);
      const afterSecond = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });

      expect(afterSecond.endsAt!.getTime()).toBe(afterFirst.endsAt!.getTime());
      expect(afterSecond.contactsUsed).toBe(afterFirst.contactsUsed);

      const rows = await processedEventRepo.find({
        where: { providerEventId: renewEventId },
      });
      expect(rows).toHaveLength(1);
    });

    it('invoice.paid with billing_reason=subscription_create (the first payment) is ignored — no double renewal', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const activateEventId = nextEventId();
      const activatePayload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        activateEventId,
      );
      await webhookService.handleWebhook(
        Buffer.from(activatePayload),
        sign(activatePayload),
      );
      const beforeReplay = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });

      const firstInvoicePayload = invoicePaidPayload(
        'subscription_create',
        nextEventId(),
        beforeReplay.externalSubscriptionId!,
      );
      const res = await request(app.getHttpServer())
        .post(path('/webhooks/payment'))
        .set('stripe-signature', sign(firstInvoicePayload))
        .set('Content-Type', 'application/json')
        .send(firstInvoicePayload)
        .expect(200);
      expect((res.body as { alreadyProcessed: boolean }).alreadyProcessed).toBe(
        false,
      );

      const afterReplay = await subscriptionRepo.findOneOrFail({
        where: { companyId },
      });
      expect(afterReplay.endsAt!.getTime()).toBe(beforeReplay.endsAt!.getTime());
      expect(afterReplay.contactsUsed).toBe(beforeReplay.contactsUsed);
    });
  });
});
