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
import { SubscriptionPlan } from '../src/modules/companies/entities/subscription.entity';
import { Invoice } from '../src/modules/billing/entities/invoice.entity';
import { PaymentWebhookService } from '../src/modules/billing/payment-webhook.service';
import { Role } from '../src/common/enums/role.enum';

describe('Invoice emission (e2e) — Lot 6C', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let invoiceRepo: Repository<Invoice>;
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
    const email = `e2e-invoice-${Date.now()}-${emailCounter}@example.com`;
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
        object: { id: `cs_${eventId}`, metadata: { companyId, plan } },
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
    return `evt_inv_e2e_${Date.now()}_${eventCounter}`;
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
    invoiceRepo = app.get(getRepositoryToken(Invoice));
    webhookService = app.get(PaymentWebhookService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Émission nominale', () => {
    it('creates exactly one Invoice with correct HT/VAT/TTC and an archived PDF key, on activation', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.GROWTH,
        nextEventId(),
      );

      await webhookService.handleWebhook(Buffer.from(payload), sign(payload));

      const invoices = await invoiceRepo.find({ where: { companyId } });
      expect(invoices).toHaveLength(1);

      const invoice = invoices[0];
      expect(invoice.invoiceNumber).toMatch(/^\d{4}-\d{4}$/);
      expect(invoice.currency).toBe('MAD');
      expect(invoice.vatRate).toBe(20);
      // growth HT = 290000 centimes (2900 MAD) -> VAT 58000 -> TTC 348000
      expect(invoice.amountHT).toBe(290000);
      expect(invoice.vatAmount).toBe(58000);
      expect(invoice.amountTTC).toBe(348000);
      expect(invoice.amountHT + invoice.vatAmount).toBe(invoice.amountTTC);
      expect(invoice.pdfStorageKey).toMatch(
        new RegExp(`^invoices/${companyId}/${invoice.invoiceNumber}\\.pdf$`),
      );
      expect(invoice.companyIce).toMatch(/^\d{15}$/);
    });
  });

  describe('Idempotence (rejeu du même event)', () => {
    it('creates exactly one invoice even when the same event is delivered twice', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const eventId = nextEventId();
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.STARTER,
        eventId,
      );
      const signature = sign(payload);

      const first = await webhookService.handleWebhook(
        Buffer.from(payload),
        signature,
      );
      expect(first.alreadyProcessed).toBe(false);

      const second = await webhookService.handleWebhook(
        Buffer.from(payload),
        signature,
      );
      expect(second.alreadyProcessed).toBe(true);

      const invoices = await invoiceRepo.find({ where: { companyId } });
      expect(invoices).toHaveLength(1);

      // Also enforced structurally: stripeInvoiceId is UNIQUE
      // (UQ_invoices_stripe_invoice_id), so even a hypothetical bug in the
      // layer-1 dedup marker could not produce two invoices for one event.
      const byStripeId = await invoiceRepo.find({
        where: { stripeInvoiceId: eventId },
      });
      expect(byStripeId).toHaveLength(1);
    });
  });

  describe('Immuabilité', () => {
    it('leaves the invoice byte-identical across a replay — no field is ever touched after emission', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.STARTER,
        nextEventId(),
      );
      const signature = sign(payload);

      await webhookService.handleWebhook(Buffer.from(payload), signature);
      const before = await invoiceRepo.findOneOrFail({ where: { companyId } });

      await webhookService.handleWebhook(Buffer.from(payload), signature);
      const after = await invoiceRepo.findOneOrFail({ where: { companyId } });

      expect(after).toEqual(before);
    });
  });

  describe('Isolation ADR-0001 — GET /invoices/:id', () => {
    it("does not let a recruiter from company B read company A's invoice", async () => {
      const recruiterA = await createVerifiedUser();
      const companyIdA = await createCompanyFor(recruiterA.token, 'Company A');
      const payload = checkoutSessionCompletedPayload(
        companyIdA,
        SubscriptionPlan.STARTER,
        nextEventId(),
      );
      await webhookService.handleWebhook(Buffer.from(payload), sign(payload));
      const invoice = await invoiceRepo.findOneOrFail({
        where: { companyId: companyIdA },
      });

      const recruiterB = await createVerifiedUser();
      await createCompanyFor(recruiterB.token, 'Company B');

      await request(app.getHttpServer())
        .get(path(`/invoices/${invoice.id}`))
        .set('Authorization', `Bearer ${recruiterB.token}`)
        .expect(404);

      const res = await request(app.getHttpServer())
        .get(path(`/invoices/${invoice.id}`))
        .set('Authorization', `Bearer ${recruiterA.token}`)
        .expect(200);
      expect((res.body as { url: string }).url).toContain(
        invoice.pdfStorageKey,
      );
    });

    it('rejects an unauthenticated request', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const payload = checkoutSessionCompletedPayload(
        companyId,
        SubscriptionPlan.STARTER,
        nextEventId(),
      );
      await webhookService.handleWebhook(Buffer.from(payload), sign(payload));
      const invoice = await invoiceRepo.findOneOrFail({
        where: { companyId },
      });

      await request(app.getHttpServer())
        .get(path(`/invoices/${invoice.id}`))
        .expect(401);
    });
  });
});
