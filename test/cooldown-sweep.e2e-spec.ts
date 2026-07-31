import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { RemediationNotificationService } from '../src/modules/assessments/remediation-notification.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { UsersService } from '../src/modules/users/users.service';
import { GrowthNotificationService } from '../src/modules/notifications/growth-notification.service';
import { Specialty } from '../src/modules/assessments/entities/specialty.entity';
import { Test as TestEntity } from '../src/modules/assessments/entities/test.entity';
import {
  Assessment,
  AssessmentStatus,
} from '../src/modules/assessments/entities/assessment.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { RefreshToken } from '../src/modules/users/entities/refresh-token.entity';
import { Role } from '../src/common/enums/role.enum';
import { DEFAULT_COOLDOWN_DAYS } from '../src/modules/assessments/cooldown';

// Deliberately does NOT import AppModule. AppModule now also registers a
// real BullMQ queue/worker (Lot 7, EF-REM-03) — fine in any environment
// with Redis (CI, prod), but this sandbox has none, and a BullMQ Worker's
// internal blocking-connection duplicate leaks an unhandled rejection deep
// inside bullmq/ioredis that Jest's circus runner attributes to whichever
// test happens to be running, failing the entire suite regardless of what
// the test itself actually proves. RemediationNotificationService has zero
// Bull/Redis dependencies (see its own file) — the concurrency guarantee
// this suite exists to prove lives entirely in the atomic UPDATE against
// real Postgres, so a minimal module (real DB, mocked collaborators) proves
// the same thing without ever touching Redis.
describe('RemediationNotificationService.runCooldownSweep (e2e) — cooldown notification idempotence, Lot 7', () => {
  let app: INestApplication;
  let service: RemediationNotificationService;
  let userRepo: Repository<User>;
  let specialtyRepo: Repository<Specialty>;
  let testRepo: Repository<TestEntity>;
  let assessmentRepo: Repository<Assessment>;
  let growthNotificationService: { notifyCooldownExpired: jest.Mock };

  async function seedExpiredCompletedAssessment(): Promise<{
    assessmentId: string;
    candidateId: string;
  }> {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-cooldown-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles: [Role.CANDIDATE],
        emailVerified: true,
      }),
    );
    const specialty = await specialtyRepo.save(
      specialtyRepo.create({
        name: `E2E cooldown specialty ${Date.now()}-${Math.random()}`,
        active: true,
      }),
    );
    const test = await testRepo.save(
      testRepo.create({
        specialtyId: specialty.id,
        version: '1.0',
        durationMinutes: 60,
        active: true,
      }),
    );
    const completedAt = new Date();
    completedAt.setDate(completedAt.getDate() - (DEFAULT_COOLDOWN_DAYS + 1));
    const assessment = await assessmentRepo.save(
      assessmentRepo.create({
        candidateId: user.id,
        testId: test.id,
        externalAssessmentId: `e2e-cooldown-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        status: AssessmentStatus.COMPLETED,
        startedAt: completedAt,
        completedAt,
        cooldownNotifiedAt: null,
      }),
    );
    return { assessmentId: assessment.id, candidateId: user.id };
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
        TypeOrmModule.forFeature([User, RefreshToken, Specialty, TestEntity, Assessment]),
      ],
      providers: [
        RemediationNotificationService,
        {
          provide: SettingsService,
          useValue: { getNumber: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockImplementation(async (id: string) => {
              const repo = app.get<Repository<User>>(getRepositoryToken(User));
              return repo.findOne({ where: { id } });
            }),
          },
        },
        {
          provide: GrowthNotificationService,
          useValue: { notifyCooldownExpired: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = app.get(RemediationNotificationService);
    userRepo = app.get(getRepositoryToken(User));
    specialtyRepo = app.get(getRepositoryToken(Specialty));
    testRepo = app.get(getRepositoryToken(TestEntity));
    assessmentRepo = app.get(getRepositoryToken(Assessment));
    growthNotificationService = app.get(GrowthNotificationService);
  });

  afterEach(() => {
    growthNotificationService.notifyCooldownExpired.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('notifies once for a candidate whose cooldown has genuinely expired, and marks cooldownNotifiedAt', async () => {
    const { assessmentId, candidateId } = await seedExpiredCompletedAssessment();

    const result = await service.runCooldownSweep();

    expect(result.notifiedCount).toBeGreaterThanOrEqual(1);
    expect(growthNotificationService.notifyCooldownExpired).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: candidateId }),
    );

    const reloaded = await assessmentRepo.findOne({ where: { id: assessmentId } });
    expect(reloaded?.cooldownNotifiedAt).not.toBeNull();
  });

  it('does not re-notify a candidate whose cooldown has not expired yet', async () => {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-cooldown-fresh-${Date.now()}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles: [Role.CANDIDATE],
        emailVerified: true,
      }),
    );
    const specialty = await specialtyRepo.save(
      specialtyRepo.create({ name: `E2E fresh specialty ${Date.now()}`, active: true }),
    );
    const test = await testRepo.save(
      testRepo.create({ specialtyId: specialty.id, version: '1.0', durationMinutes: 60, active: true }),
    );
    const recentCompletedAt = new Date();
    recentCompletedAt.setDate(recentCompletedAt.getDate() - 1); // well within cooldown
    const assessment = await assessmentRepo.save(
      assessmentRepo.create({
        candidateId: user.id,
        testId: test.id,
        externalAssessmentId: `e2e-cooldown-fresh-${Date.now()}`,
        status: AssessmentStatus.COMPLETED,
        startedAt: recentCompletedAt,
        completedAt: recentCompletedAt,
        cooldownNotifiedAt: null,
      }),
    );

    await service.runCooldownSweep();

    expect(growthNotificationService.notifyCooldownExpired).not.toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: user.id }),
    );
    const reloaded = await assessmentRepo.findOne({ where: { id: assessment.id } });
    expect(reloaded?.cooldownNotifiedAt).toBeNull();
  });

  describe('Concurrency — the key idempotence proof', () => {
    it('two parallel sweeps over the same expired, unnotified assessment produce exactly one notification and one cooldownNotifiedAt write', async () => {
      const { assessmentId, candidateId } = await seedExpiredCompletedAssessment();

      const [first, second] = await Promise.all([
        service.runCooldownSweep(),
        service.runCooldownSweep(),
      ]);

      // Between the two sweeps, exactly one notification total must have
      // gone out for this specific candidate — never zero (lost write),
      // never two (double-notified), regardless of how the two concurrent
      // runs interleaved.
      const callsForThisCandidate =
        growthNotificationService.notifyCooldownExpired.mock.calls.filter(
          (call) => call[0]?.recipientUserId === candidateId,
        );
      expect(callsForThisCandidate).toHaveLength(1);
      expect(first.notifiedCount + second.notifiedCount).toBeGreaterThanOrEqual(1);

      const reloaded = await assessmentRepo.findOne({ where: { id: assessmentId } });
      expect(reloaded?.cooldownNotifiedAt).not.toBeNull();
    });

    it('re-running the sweep after a successful run notifies nobody a second time (retry-after-crash simulation)', async () => {
      const { candidateId } = await seedExpiredCompletedAssessment();

      await service.runCooldownSweep();
      growthNotificationService.notifyCooldownExpired.mockClear();

      const second = await service.runCooldownSweep();

      const callsForThisCandidate =
        growthNotificationService.notifyCooldownExpired.mock.calls.filter(
          (call) => call[0]?.recipientUserId === candidateId,
        );
      expect(callsForThisCandidate).toHaveLength(0);
      expect(second.notifiedCount).toBe(0);
    });
  });
});
