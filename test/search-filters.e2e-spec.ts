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

// EF-SRCH-02 — the search filters (full-text q, location, pagination) were
// only covered by unit tests against a mocked query-builder. This proves them
// end-to-end against real Postgres over real HTTP: seed indexed/public
// profiles sharing a marker location and assert q narrows, location matches,
// and the limit+cursor pagination works.
describe('Search filters (e2e) — EF-SRCH-02', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let profileRepo: Repository<CandidateProfile>;

  const marker = `E2E-FILT-${Date.now()}`;
  const uniqueTerm = `kubernetesspecialist${Date.now()}`;

  let emailCounter = 0;
  async function createUser(roles: Role[]): Promise<User> {
    emailCounter += 1;
    return userRepo.save(
      userRepo.create({
        email: `e2e-filt-${Date.now()}-${emailCounter}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles,
        emailVerified: true,
      }),
    );
  }

  async function seedProfile(headline: string): Promise<CandidateProfile> {
    const user = await createUser([Role.CANDIDATE]);
    return profileRepo.save(
      profileRepo.create({
        userId: user.id,
        headline,
        location: marker,
        visibility: ProfileVisibility.PUBLIC,
        indexedInCvtheque: true,
        completeness: 100,
      }),
    );
  }

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  let adminToken: string;
  let matchingId: string;
  let otherId: string;

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

    const admin = await createUser([Role.ADMIN]);
    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      roles: admin.roles,
    });

    matchingId = (await seedProfile(`Senior ${uniqueTerm} engineer`)).id;
    otherId = (await seedProfile('Senior frontend engineer')).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('matches both profiles by location', async () => {
    const res = await request(app.getHttpServer())
      .get(path(`/search/candidates?location=${marker}`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = (res.body as { items: { id: string }[] }).items.map(
      (i) => i.id,
    );
    expect(ids).toContain(matchingId);
    expect(ids).toContain(otherId);
  });

  it('narrows by full-text q to only the matching headline', async () => {
    const res = await request(app.getHttpServer())
      .get(path(`/search/candidates?location=${marker}&q=${uniqueTerm}`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = (res.body as { items: { id: string }[] }).items.map(
      (i) => i.id,
    );
    expect(ids).toContain(matchingId);
    expect(ids).not.toContain(otherId);
  });

  it('paginates with limit + nextCursor', async () => {
    const res = await request(app.getHttpServer())
      .get(path(`/search/candidates?location=${marker}&limit=1`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = res.body as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBeTruthy();
  });

  it('rejects an out-of-range scoreMin (validation)', async () => {
    await request(app.getHttpServer())
      .get(path(`/search/candidates?scoreMin=200`))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
