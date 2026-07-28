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

describe('Shortlist (e2e) — EF-RECR-06', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let profileRepo: Repository<CandidateProfile>;

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
    const email = `e2e-shortlist-${Date.now()}-${emailCounter}@example.com`;
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

  async function freshToken(userId: string): Promise<string> {
    const user = await userRepo.findOne({ where: { id: userId } });
    return jwtService.sign({
      sub: userId,
      email: user!.email,
      roles: user!.roles,
    });
  }

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  async function createCompanyFor(
    token: string,
    name = 'Acme Corp',
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(path('/companies'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name, ice: nextIce() })
      .expect(201);
  }

  async function createIndexedCandidateProfile(): Promise<string> {
    const candidate = await createVerifiedUser([Role.CANDIDATE]);
    const profile = await profileRepo.save(
      profileRepo.create({
        userId: candidate.userId,
        headline: 'Senior backend engineer',
        visibility: ProfileVisibility.PUBLIC,
        indexedInCvtheque: true,
      }),
    );
    return profile.id;
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
    profileRepo = app.get(getRepositoryToken(CandidateProfile));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario 1 — ajout, liste, retrait (partage intra-entreprise)', () => {
    it('lets any recruiter of the company see an entry added by a teammate', async () => {
      const admin = await createVerifiedUser();
      await createCompanyFor(admin.token);
      const adminToken = await freshToken(admin.userId);

      const teammate = await createVerifiedUser([Role.CANDIDATE]);
      await request(app.getHttpServer())
        .post(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: teammate.email })
        .expect(201);
      const teammateToken = await freshToken(teammate.userId);

      const candidateProfileId = await createIndexedCandidateProfile();

      const addRes = await request(app.getHttpServer())
        .post(path('/companies/shortlist'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ candidateProfileId, note: 'Strong React background' })
        .expect(201);
      const entry = addRes.body as { id: string };

      const listRes = await request(app.getHttpServer())
        .get(path('/companies/shortlist'))
        .set('Authorization', `Bearer ${teammateToken}`)
        .expect(200);
      const listBody = listRes.body as Array<{ id: string }>;
      expect(listBody.map((e) => e.id)).toContain(entry.id);

      await request(app.getHttpServer())
        .delete(path(`/companies/shortlist/${entry.id}`))
        .set('Authorization', `Bearer ${teammateToken}`)
        .expect(200);
    });

    it('rejects adding the same candidate twice (409)', async () => {
      const admin = await createVerifiedUser();
      await createCompanyFor(admin.token);
      const adminToken = await freshToken(admin.userId);
      const candidateProfileId = await createIndexedCandidateProfile();

      await request(app.getHttpServer())
        .post(path('/companies/shortlist'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ candidateProfileId })
        .expect(201);

      await request(app.getHttpServer())
        .post(path('/companies/shortlist'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ candidateProfileId })
        .expect(409);
    });

    it('rejects a non-indexed candidate profile (404)', async () => {
      const admin = await createVerifiedUser();
      await createCompanyFor(admin.token);
      const adminToken = await freshToken(admin.userId);

      const hiddenCandidate = await createVerifiedUser([Role.CANDIDATE]);
      const hiddenProfile = await profileRepo.save(
        profileRepo.create({
          userId: hiddenCandidate.userId,
          visibility: ProfileVisibility.HIDDEN,
          indexedInCvtheque: false,
        }),
      );

      await request(app.getHttpServer())
        .post(path('/companies/shortlist'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ candidateProfileId: hiddenProfile.id })
        .expect(404);
    });
  });

  describe('Scenario 2 — isolation stricte entre entreprises', () => {
    it("does not let a recruiter remove another company's shortlist entry", async () => {
      const adminA = await createVerifiedUser();
      await createCompanyFor(adminA.token, 'Company A');
      const adminAToken = await freshToken(adminA.userId);
      const candidateProfileId = await createIndexedCandidateProfile();

      const addRes = await request(app.getHttpServer())
        .post(path('/companies/shortlist'))
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ candidateProfileId })
        .expect(201);
      const entry = addRes.body as { id: string };

      const adminB = await createVerifiedUser();
      await createCompanyFor(adminB.token, 'Company B');
      const adminBToken = await freshToken(adminB.userId);

      await request(app.getHttpServer())
        .delete(path(`/companies/shortlist/${entry.id}`))
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(404);

      const listRes = await request(app.getHttpServer())
        .get(path('/companies/shortlist'))
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(200);
      expect(listRes.body).toEqual([]);
    });
  });
});
