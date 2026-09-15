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

// EF-SRCH-03 — the CDC's strictest guarantee: "a masked profile NEVER
// appears". The unit tests only prove the query-builder WHERE against a mock;
// this proves it end-to-end against real Postgres over real HTTP — seed a
// hidden profile and a non-indexed profile alongside a visible one, and
// assert only the visible one is ever returned (list AND detail).
describe("Search visibility (e2e) — EF-SRCH-03, un profil masqué n'apparaît jamais", () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let profileRepo: Repository<CandidateProfile>;

  // A unique marker so this suite only ever asserts on its own seeded rows,
  // regardless of what other e2e suites left in the shared test database.
  const marker = `E2E-VIS-${Date.now()}`;

  let emailCounter = 0;
  async function createUser(roles: Role[]): Promise<User> {
    emailCounter += 1;
    return userRepo.save(
      userRepo.create({
        email: `e2e-vis-${Date.now()}-${emailCounter}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles,
        emailVerified: true,
      }),
    );
  }

  async function seedProfile(overrides: {
    visibility: ProfileVisibility;
    indexedInCvtheque: boolean;
    headline: string;
  }): Promise<CandidateProfile> {
    const user = await createUser([Role.CANDIDATE]);
    return profileRepo.save(
      profileRepo.create({
        userId: user.id,
        headline: overrides.headline,
        location: marker,
        visibility: overrides.visibility,
        indexedInCvtheque: overrides.indexedInCvtheque,
        completeness: 100,
      }),
    );
  }

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  let adminToken: string;
  let visibleId: string;
  let hiddenId: string;
  let unindexedId: string;

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
    profileRepo = app.get(getRepositoryToken(CandidateProfile));

    // Search as ADMIN — it is allowed and skips the active-subscription gate,
    // keeping this suite focused purely on the visibility filter.
    const admin = await createUser([Role.ADMIN]);
    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      roles: admin.roles,
    });

    visibleId = (
      await seedProfile({
        visibility: ProfileVisibility.PUBLIC,
        indexedInCvtheque: true,
        headline: 'Visible senior engineer',
      })
    ).id;
    hiddenId = (
      await seedProfile({
        visibility: ProfileVisibility.HIDDEN,
        indexedInCvtheque: true,
        headline: 'Hidden senior engineer',
      })
    ).id;
    unindexedId = (
      await seedProfile({
        visibility: ProfileVisibility.PUBLIC,
        indexedInCvtheque: false,
        headline: 'Unindexed senior engineer',
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the visible profile but never the hidden or non-indexed ones', async () => {
    const res = await request(app.getHttpServer())
      .get(path(`/search/candidates?location=${marker}`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = res.body as { items: { id: string }[] };
    const ids = body.items.map((i) => i.id);

    expect(ids).toContain(visibleId);
    expect(ids).not.toContain(hiddenId);
    expect(ids).not.toContain(unindexedId);
  });

  it('serves the visible profile detail (200)', async () => {
    await request(app.getHttpServer())
      .get(path(`/search/candidates/${visibleId}`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('returns 404 for a hidden profile detail — indistinguishable from nonexistent', async () => {
    await request(app.getHttpServer())
      .get(path(`/search/candidates/${hiddenId}`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('returns 404 for a non-indexed profile detail', async () => {
    await request(app.getHttpServer())
      .get(path(`/search/candidates/${unindexedId}`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
