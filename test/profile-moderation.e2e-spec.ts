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
  CandidateProfile,
  ProfileVisibility,
} from '../src/modules/candidates/entities/candidate-profile.entity';
import { Role } from '../src/common/enums/role.enum';
import { StaffMfaGuard } from '../src/common/guards/staff-mfa.guard';

// EF-ADM-01 — admin profile moderation, end to end: an admin suspends an
// indexed/public candidate profile and it vanishes from the CVthèque (list +
// detail), then reinstating brings it back. The staff-MFA guard is overridden
// (its step-up is unit-tested elsewhere) so this focuses on the moderation rule.
describe('Profile moderation (e2e) — EF-ADM-01', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let profileRepo: Repository<CandidateProfile>;

  const marker = `E2E-MOD-${Date.now()}`;
  let iceCounter = 0;
  const nextIce = () =>
    String(Date.now() + ++iceCounter)
      .padStart(15, '0')
      .slice(-15);

  let emailCounter = 0;
  async function createUser(roles: Role[]): Promise<{ userId: string; token: string }> {
    emailCounter += 1;
    const email = `e2e-mod-${Date.now()}-${emailCounter}@example.com`;
    const user = await userRepo.save(
      userRepo.create({ email, passwordHash: 'x', roles, emailVerified: true }),
    );
    return {
      userId: user.id,
      token: jwtService.sign({ sub: user.id, email, roles: user.roles }),
    };
  }

  const path = (p: string) => `/${apiPrefix}${p}`;

  async function seedIndexedProfile(): Promise<string> {
    const candidate = await createUser([Role.CANDIDATE]);
    const profile = await profileRepo.save(
      profileRepo.create({
        userId: candidate.userId,
        headline: marker,
        location: marker,
        visibility: ProfileVisibility.PUBLIC,
        indexedInCvtheque: true,
        completeness: 100,
      }),
    );
    return profile.id;
  }

  async function createRecruiterWithSubscription(): Promise<string> {
    const recruiter = await createUser([Role.RECRUITER]);
    await request(app.getHttpServer())
      .post(path('/companies'))
      .set('Authorization', `Bearer ${recruiter.token}`)
      .send({ name: 'Mod Co', ice: nextIce() })
      .expect(201);
    return recruiter.token;
  }

  async function searchHasProfile(token: string, id: string): Promise<boolean> {
    const res = await request(app.getHttpServer())
      .get(path(`/search/candidates?q=${marker}&limit=50`))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return (res.body as { items: { id: string }[] }).items.some((i) => i.id === id);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(StaffMfaGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    const configService = app.get(ConfigService);
    apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
    app.setGlobalPrefix(apiPrefix);
    await app.init();

    jwtService = app.get(JwtService);
    userRepo = app.get(getRepositoryToken(User));
    profileRepo = app.get(getRepositoryToken(CandidateProfile));
  });

  afterAll(async () => {
    await app.close();
  });

  it('suspending a profile removes it from search (list + detail), reinstating restores it', async () => {
    const profileId = await seedIndexedProfile();
    const recruiterToken = await createRecruiterWithSubscription();
    const admin = await createUser([Role.ADMIN]);

    // Visible before moderation.
    expect(await searchHasProfile(recruiterToken, profileId)).toBe(true);

    // Admin suspends.
    const suspended = await request(app.getHttpServer())
      .patch(path(`/admin/profiles/${profileId}/moderation`))
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'suspended' })
      .expect(200);
    expect((suspended.body as { moderationStatus: string }).moderationStatus).toBe(
      'suspended',
    );

    // Gone from list AND detail.
    expect(await searchHasProfile(recruiterToken, profileId)).toBe(false);
    await request(app.getHttpServer())
      .get(path(`/search/candidates/${profileId}`))
      .set('Authorization', `Bearer ${recruiterToken}`)
      .expect(404);

    // Suspended profile appears in the admin's suspended queue.
    const queue = await request(app.getHttpServer())
      .get(path('/admin/profiles?status=suspended&limit=100'))
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(
      (queue.body as { items: { id: string }[] }).items.some((p) => p.id === profileId),
    ).toBe(true);

    // Reinstate → the candidate can be indexed again. (Visibility was pinned to
    // HIDDEN on suspend; restore it as the candidate would, then confirm it can
    // resurface in search.)
    await request(app.getHttpServer())
      .patch(path(`/admin/profiles/${profileId}/moderation`))
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'active' })
      .expect(200);
    await profileRepo.update({ id: profileId }, { visibility: ProfileVisibility.PUBLIC });
    expect(await searchHasProfile(recruiterToken, profileId)).toBe(true);
  });

  it('rejects a non-admin caller (403)', async () => {
    const profileId = await seedIndexedProfile();
    const candidate = await createUser([Role.CANDIDATE]);
    await request(app.getHttpServer())
      .patch(path(`/admin/profiles/${profileId}/moderation`))
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({ status: 'suspended' })
      .expect(403);
  });
});
