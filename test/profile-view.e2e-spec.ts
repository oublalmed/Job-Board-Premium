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
import { ProfileViewService } from '../src/modules/search/profile-view.service';
import { CandidateProfileView } from '../src/modules/search/entities/candidate-profile-view.entity';
import { ProfileViewCooldown } from '../src/modules/search/entities/profile-view-cooldown.entity';
import { GrowthNotificationService } from '../src/modules/notifications/growth-notification.service';
import { UsersModule } from '../src/modules/users/users.module';
import { User } from '../src/modules/users/entities/user.entity';
import { RefreshToken } from '../src/modules/users/entities/refresh-token.entity';
import { CandidateProfile, ProfileVisibility } from '../src/modules/candidates/entities/candidate-profile.entity';
import { Company } from '../src/modules/companies/entities/company.entity';
import { Role } from '../src/common/enums/role.enum';

// Deliberately does NOT import AppModule — same reasoning as
// cooldown-sweep.e2e-spec.ts (Lot 7 commit 2): AppModule now registers a
// real BullMQ queue, which leaks an unhandled rejection in a Redis-less
// sandbox that Jest attributes to whatever test is running. ProfileViewService
// has zero Bull/Redis dependencies — the concurrency guarantee this suite
// exists to prove lives entirely in the atomic UPSERT against real
// Postgres, so a minimal module (real DB, mocked notification collaborator)
// proves the same thing without touching Redis.
describe('ProfileViewService.recordView (e2e) — anti-spam notification claim, Lot 7', () => {
  let app: INestApplication;
  let service: ProfileViewService;
  let userRepo: Repository<User>;
  let companyRepo: Repository<Company>;
  let candidateProfileRepo: Repository<CandidateProfile>;
  let viewRepo: Repository<CandidateProfileView>;
  let cooldownRepo: Repository<ProfileViewCooldown>;
  let growthNotificationService: { notifyProfileViewed: jest.Mock };

  let iceCounter = 0;
  function nextIce(): string {
    iceCounter += 1;
    return String(Date.now() + iceCounter).padStart(15, '0').slice(-15);
  }

  async function seedRecruiter(): Promise<{ userId: string; companyId: string }> {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-view-recruiter-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles: [Role.RECRUITER],
        emailVerified: true,
      }),
    );
    const company = await companyRepo.save(
      companyRepo.create({ name: 'E2E View Co', ice: nextIce() }),
    );
    return { userId: user.id, companyId: company.id };
  }

  async function seedVisibleCandidateProfile(): Promise<{
    profileId: string;
    candidateUserId: string;
  }> {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-view-candidate-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles: [Role.CANDIDATE],
        emailVerified: true,
      }),
    );
    const profile = await candidateProfileRepo.save(
      candidateProfileRepo.create({
        userId: user.id,
        visibility: ProfileVisibility.PUBLIC,
        indexedInCvtheque: true,
      }),
    );
    return { profileId: profile.id, candidateUserId: user.id };
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
          User,
          RefreshToken,
          Company,
          CandidateProfile,
          CandidateProfileView,
          ProfileViewCooldown,
        ]),
        UsersModule,
      ],
      providers: [
        ProfileViewService,
        {
          provide: GrowthNotificationService,
          useValue: { notifyProfileViewed: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = app.get(ProfileViewService);
    userRepo = app.get(getRepositoryToken(User));
    companyRepo = app.get(getRepositoryToken(Company));
    candidateProfileRepo = app.get(getRepositoryToken(CandidateProfile));
    viewRepo = app.get(getRepositoryToken(CandidateProfileView));
    cooldownRepo = app.get(getRepositoryToken(ProfileViewCooldown));
    growthNotificationService = app.get(GrowthNotificationService);
  });

  afterEach(() => {
    growthNotificationService.notifyProfileViewed.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('records the view and sends exactly one notification for a first-ever view', async () => {
    const recruiter = await seedRecruiter();
    const candidate = await seedVisibleCandidateProfile();

    await service.recordView(recruiter.userId, recruiter.companyId, candidate.profileId);

    const views = await viewRepo.find({
      where: { recruiterId: recruiter.userId, candidateProfileId: candidate.profileId },
    });
    expect(views).toHaveLength(1);
    expect(growthNotificationService.notifyProfileViewed).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: candidate.candidateUserId }),
    );
  });

  it('records a second view inside the cooldown window but does not notify again (anti-spam)', async () => {
    const recruiter = await seedRecruiter();
    const candidate = await seedVisibleCandidateProfile();

    await service.recordView(recruiter.userId, recruiter.companyId, candidate.profileId);
    growthNotificationService.notifyProfileViewed.mockClear();
    await service.recordView(recruiter.userId, recruiter.companyId, candidate.profileId);

    const views = await viewRepo.find({
      where: { recruiterId: recruiter.userId, candidateProfileId: candidate.profileId },
    });
    // The audit trail always grows — both views are tracked...
    expect(views).toHaveLength(2);
    // ...but the second one, inside the cooldown window, notifies nobody.
    expect(growthNotificationService.notifyProfileViewed).not.toHaveBeenCalled();

    const cooldownRows = await cooldownRepo.find({
      where: { recruiterId: recruiter.userId, candidateProfileId: candidate.profileId },
    });
    expect(cooldownRows).toHaveLength(1);
  });

  describe('Concurrency — the key anti-spam proof', () => {
    it('N simultaneous views from the same recruiter on the same candidate produce exactly one notification', async () => {
      const recruiter = await seedRecruiter();
      const candidate = await seedVisibleCandidateProfile();

      await Promise.all(
        Array.from({ length: 5 }, () =>
          service.recordView(recruiter.userId, recruiter.companyId, candidate.profileId),
        ),
      );

      const views = await viewRepo.find({
        where: { recruiterId: recruiter.userId, candidateProfileId: candidate.profileId },
      });
      // Every view is still recorded — the audit trail is never
      // deduplicated, only the notification is.
      expect(views).toHaveLength(5);
      expect(growthNotificationService.notifyProfileViewed).toHaveBeenCalledTimes(1);

      const cooldownRows = await cooldownRepo.find({
        where: { recruiterId: recruiter.userId, candidateProfileId: candidate.profileId },
      });
      expect(cooldownRows).toHaveLength(1);
    });

    it('views from different recruiters on the same candidate each notify independently (the window is per recruiter+candidate, not per candidate)', async () => {
      const recruiterA = await seedRecruiter();
      const recruiterB = await seedRecruiter();
      const candidate = await seedVisibleCandidateProfile();

      await Promise.all([
        service.recordView(recruiterA.userId, recruiterA.companyId, candidate.profileId),
        service.recordView(recruiterB.userId, recruiterB.companyId, candidate.profileId),
      ]);

      expect(growthNotificationService.notifyProfileViewed).toHaveBeenCalledTimes(2);
    });
  });
});
