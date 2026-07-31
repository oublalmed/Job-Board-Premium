import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  appConfig,
  databaseConfig,
  authConfig,
  storageConfig,
  businessConfig,
  scoringConfig,
  paymentConfig,
  legalConfig,
  configValidationSchema,
} from '../src/config/index';
import { TrialCodeRedemptionService } from '../src/modules/billing/trial-code-redemption.service';
import { SubscriptionGuardService } from '../src/modules/companies/subscription-guard.service';
import { TrialCode, TrialCodeStatus } from '../src/modules/billing/entities/trial-code.entity';
import { TrialCodeRedemption } from '../src/modules/billing/entities/trial-code-redemption.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../src/modules/companies/entities/subscription.entity';
import { Company } from '../src/modules/companies/entities/company.entity';
import {
  InvalidTrialCodeException,
  TrialCodeAlreadyRedeemedException,
  TrialCodeNotEligibleException,
} from '../src/modules/billing/billing.exceptions';

// Deliberately does NOT import AppModule (see cooldown-sweep.e2e-spec.ts /
// profile-view.e2e-spec.ts, Lot 7 commits 2-3, for the full reasoning): a
// real BullMQ queue registered on AppModule leaks an unhandled rejection
// in this Redis-less sandbox that fails whatever Jest test is running,
// regardless of what that test actually exercises. TrialCodeRedemptionService
// has no Bull/Redis dependency at all — the guarantees this suite exists to
// prove (atomic quota claim, anti-stacking) live entirely in Postgres.
// SubscriptionGuardService is mocked here (its own behavior is already
// covered elsewhere) so this suite stays scoped to redemption atomicity.
describe('TrialCodeRedemptionService.redeem (e2e) — Lot 7 EF-GROW-03', () => {
  let app: INestApplication;
  let service: TrialCodeRedemptionService;
  let companyRepo: Repository<Company>;
  let subscriptionRepo: Repository<Subscription>;
  let trialCodeRepo: Repository<TrialCode>;
  let redemptionRepo: Repository<TrialCodeRedemption>;
  let subscriptionGuard: { resolveCompanyId: jest.Mock };

  let iceCounter = 0;
  function nextIce(): string {
    iceCounter += 1;
    return String(Date.now() + iceCounter).padStart(15, '0').slice(-15);
  }

  async function seedTrialCompany(): Promise<{ companyId: string }> {
    const company = await companyRepo.save(
      companyRepo.create({ name: 'E2E Trial Co', ice: nextIce() }),
    );
    await subscriptionRepo.save(
      subscriptionRepo.create({
        companyId: company.id,
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.TRIAL,
        contactQuota: 15,
        contactsUsed: 0,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }),
    );
    return { companyId: company.id };
  }

  async function seedTrialCode(
    overrides: Partial<TrialCode> = {},
  ): Promise<TrialCode> {
    return trialCodeRepo.save(
      trialCodeRepo.create({
        code: `E2E-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        plan: SubscriptionPlan.GROWTH,
        trialDurationDays: 30,
        maxUses: 10,
        usedCount: 0,
        status: TrialCodeStatus.ACTIVE,
        expiresAt: null,
        ...overrides,
      }),
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            appConfig,
            databaseConfig,
            authConfig,
            storageConfig,
            businessConfig,
            scoringConfig,
            paymentConfig,
            legalConfig,
          ],
          validationSchema: configValidationSchema,
          validationOptions: { abortEarly: true },
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres' as const,
            host: config.getOrThrow<string>('database.host'),
            port: config.getOrThrow<number>('database.port'),
            username: config.getOrThrow<string>('database.username'),
            password: config.getOrThrow<string>('database.password'),
            database: config.getOrThrow<string>('database.database'),
            synchronize: false,
            logging: false,
            autoLoadEntities: true,
          }),
        }),
        TypeOrmModule.forFeature([
          Company,
          Subscription,
          TrialCode,
          TrialCodeRedemption,
        ]),
      ],
      providers: [
        TrialCodeRedemptionService,
        {
          provide: SubscriptionGuardService,
          useValue: { resolveCompanyId: jest.fn() },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = app.get(TrialCodeRedemptionService);
    companyRepo = app.get(getRepositoryToken(Company));
    subscriptionRepo = app.get(getRepositoryToken(Subscription));
    trialCodeRepo = app.get(getRepositoryToken(TrialCode));
    redemptionRepo = app.get(getRepositoryToken(TrialCodeRedemption));
    subscriptionGuard = app.get(SubscriptionGuardService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('redeems a valid code: extends the trial subscription and tracks the redemption, no payment', async () => {
    const { companyId } = await seedTrialCompany();
    subscriptionGuard.resolveCompanyId.mockResolvedValueOnce(companyId);
    const trialCode = await seedTrialCode();

    const result = await service.redeem('user-1', trialCode.code);

    expect(result.plan).toBe(SubscriptionPlan.GROWTH);

    const subscription = await subscriptionRepo.findOne({
      where: { companyId, status: SubscriptionStatus.TRIAL },
    });
    expect(subscription?.plan).toBe(SubscriptionPlan.GROWTH);

    const redemption = await redemptionRepo.findOne({ where: { companyId } });
    expect(redemption).not.toBeNull();
    expect(redemption?.convertedAt).toBeNull();

    const reloadedCode = await trialCodeRepo.findOne({ where: { id: trialCode.id } });
    expect(reloadedCode?.usedCount).toBe(1);
  });

  it('rejects a nonexistent code', async () => {
    const { companyId } = await seedTrialCompany();
    subscriptionGuard.resolveCompanyId.mockResolvedValueOnce(companyId);

    await expect(service.redeem('user-1', 'DOES-NOT-EXIST')).rejects.toThrow(
      InvalidTrialCodeException,
    );
  });

  it('rejects an expired code', async () => {
    const { companyId } = await seedTrialCompany();
    subscriptionGuard.resolveCompanyId.mockResolvedValueOnce(companyId);
    const trialCode = await seedTrialCode({ expiresAt: new Date('2020-01-01') });

    await expect(service.redeem('user-1', trialCode.code)).rejects.toThrow(
      InvalidTrialCodeException,
    );
  });

  it('rejects a code whose quota is exhausted', async () => {
    const { companyId } = await seedTrialCompany();
    subscriptionGuard.resolveCompanyId.mockResolvedValueOnce(companyId);
    const trialCode = await seedTrialCode({ maxUses: 1, usedCount: 1 });

    await expect(service.redeem('user-1', trialCode.code)).rejects.toThrow(
      InvalidTrialCodeException,
    );
  });

  it('rejects a company that is not currently on TRIAL', async () => {
    const company = await companyRepo.save(
      companyRepo.create({ name: 'E2E Active Co', ice: nextIce() }),
    );
    await subscriptionRepo.save(
      subscriptionRepo.create({
        companyId: company.id,
        plan: SubscriptionPlan.GROWTH,
        status: SubscriptionStatus.ACTIVE,
        contactQuota: 60,
        contactsUsed: 0,
        startsAt: new Date(),
        endsAt: null,
      }),
    );
    subscriptionGuard.resolveCompanyId.mockResolvedValueOnce(company.id);
    const trialCode = await seedTrialCode();

    await expect(service.redeem('user-1', trialCode.code)).rejects.toThrow(
      TrialCodeNotEligibleException,
    );
  });

  it('rejects a second redemption by the same company, even for a different code', async () => {
    const { companyId } = await seedTrialCompany();
    subscriptionGuard.resolveCompanyId.mockResolvedValue(companyId);
    const firstCode = await seedTrialCode();
    const secondCode = await seedTrialCode();

    await service.redeem('user-1', firstCode.code);

    await expect(service.redeem('user-1', secondCode.code)).rejects.toThrow(
      TrialCodeAlreadyRedeemedException,
    );
  });

  describe('Concurrency — the key anti-abuse proofs', () => {
    it('with maxUses=1, two different companies racing the same code yield exactly one success', async () => {
      const companyA = await seedTrialCompany();
      const companyB = await seedTrialCompany();
      const trialCode = await seedTrialCode({ maxUses: 1 });

      subscriptionGuard.resolveCompanyId
        .mockResolvedValueOnce(companyA.companyId)
        .mockResolvedValueOnce(companyB.companyId);

      const results = await Promise.allSettled([
        service.redeem('user-a', trialCode.code),
        service.redeem('user-b', trialCode.code),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        InvalidTrialCodeException,
      );

      const reloadedCode = await trialCodeRepo.findOne({ where: { id: trialCode.id } });
      // Proof of atomicity: exactly one use landed, never two (quota blown
      // past its limit) and never zero (the successful call's write lost).
      expect(reloadedCode?.usedCount).toBe(1);
    });

    it('the same company racing itself with two parallel redeem calls only ever succeeds once', async () => {
      const { companyId } = await seedTrialCompany();
      subscriptionGuard.resolveCompanyId.mockResolvedValue(companyId);
      const codeA = await seedTrialCode();
      const codeB = await seedTrialCode();

      const results = await Promise.allSettled([
        service.redeem('user-1', codeA.code),
        service.redeem('user-1', codeB.code),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);

      const redemptions = await redemptionRepo.find({ where: { companyId } });
      expect(redemptions).toHaveLength(1);
    });
  });
});
