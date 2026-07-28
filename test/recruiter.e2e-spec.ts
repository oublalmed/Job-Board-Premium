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
import { Role } from '../src/common/enums/role.enum';

describe('Recruiters (e2e) — EF-RECR-02', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;

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
    emailVerified = true,
  ): Promise<{ userId: string; email: string; token: string }> {
    emailCounter += 1;
    const email = `e2e-recruiters-${Date.now()}-${emailCounter}@example.com`;
    const user = await userRepo.save(
      userRepo.create({
        email,
        passwordHash: 'irrelevant-for-this-test',
        roles,
        emailVerified,
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario 1 — ajout, liste, retrait (flux nominal)', () => {
    it('lets a company_admin add, list and remove a recruiter', async () => {
      const admin = await createVerifiedUser();
      await createCompanyFor(admin.token);
      const adminToken = await freshToken(admin.userId);

      const target = await createVerifiedUser([Role.CANDIDATE]);

      const addRes = await request(app.getHttpServer())
        .post(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: target.email, position: 'Talent Lead' })
        .expect(201);
      const addBody = addRes.body as { id: string };

      const listRes = await request(app.getHttpServer())
        .get(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const listBody = listRes.body as Array<{ email: string }>;
      expect(listBody.map((r) => r.email)).toContain(target.email);

      const updatedTarget = await userRepo.findOne({
        where: { id: target.userId },
      });
      expect(updatedTarget?.roles).toContain(Role.RECRUITER);

      await request(app.getHttpServer())
        .delete(path(`/companies/recruiters/${addBody.id}`))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const removedTarget = await userRepo.findOne({
        where: { id: target.userId },
      });
      expect(removedTarget?.roles).not.toContain(Role.RECRUITER);
    });
  });

  describe('Scenario 2 — RBAC : un recruteur (non-admin) ne gère pas les utilisateurs', () => {
    it('rejects add/remove from a plain recruiter with 403', async () => {
      const admin = await createVerifiedUser();
      await createCompanyFor(admin.token);
      const adminToken = await freshToken(admin.userId);

      const plainRecruiter = await createVerifiedUser([Role.CANDIDATE]);
      await request(app.getHttpServer())
        .post(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: plainRecruiter.email })
        .expect(201);
      const recruiterToken = await freshToken(plainRecruiter.userId);

      const anotherTarget = await createVerifiedUser([Role.CANDIDATE]);
      await request(app.getHttpServer())
        .post(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ email: anotherTarget.email })
        .expect(403);

      // A plain recruiter can still view the roster.
      await request(app.getHttpServer())
        .get(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);
    });
  });

  describe('Scenario 3 — isolation stricte entre entreprises', () => {
    it("does not let a company_admin remove another company's recruiter", async () => {
      const adminA = await createVerifiedUser();
      await createCompanyFor(adminA.token, 'Company A');
      const adminAToken = await freshToken(adminA.userId);

      const recruiterA = await createVerifiedUser([Role.CANDIDATE]);
      const addRes = await request(app.getHttpServer())
        .post(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ email: recruiterA.email })
        .expect(201);
      const recruiterAId = (addRes.body as { id: string }).id;

      const adminB = await createVerifiedUser();
      await createCompanyFor(adminB.token, 'Company B');
      const adminBToken = await freshToken(adminB.userId);

      await request(app.getHttpServer())
        .delete(path(`/companies/recruiters/${recruiterAId}`))
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(404);

      const listRes = await request(app.getHttpServer())
        .get(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(200);
      const listBody = listRes.body as Array<{ email: string }>;
      expect(listBody.map((r) => r.email)).not.toContain(recruiterA.email);
    });
  });

  describe('Scenario 4 — garde-fous', () => {
    it('rejects a company_admin removing themselves (409)', async () => {
      const admin = await createVerifiedUser();
      await createCompanyFor(admin.token);
      const adminToken = await freshToken(admin.userId);

      const meRes = await request(app.getHttpServer())
        .get(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const meBody = meRes.body as Array<{ id: string; email: string }>;
      const selfEntry = meBody.find((r) => r.email === admin.email)!;

      await request(app.getHttpServer())
        .delete(path(`/companies/recruiters/${selfEntry.id}`))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    });

    it('rejects adding a user whose email is not verified (403)', async () => {
      const admin = await createVerifiedUser();
      await createCompanyFor(admin.token);
      const adminToken = await freshToken(admin.userId);

      const unverified = await createVerifiedUser([Role.CANDIDATE], false);

      await request(app.getHttpServer())
        .post(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: unverified.email })
        .expect(403);
    });

    it('rejects adding a user already attached to a company (409)', async () => {
      const adminA = await createVerifiedUser();
      await createCompanyFor(adminA.token, 'Company A2');
      const adminAToken = await freshToken(adminA.userId);

      const adminB = await createVerifiedUser();
      await createCompanyFor(adminB.token, 'Company B2');

      // adminB is already attached to their own company (Company B2).
      await request(app.getHttpServer())
        .post(path('/companies/recruiters'))
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ email: adminB.email })
        .expect(409);
    });
  });
});
