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
import { Subscription } from '../src/modules/companies/entities/subscription.entity';
import { Role } from '../src/common/enums/role.enum';

describe('Job offers (e2e) — EF-RECR-03', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let subscriptionRepo: Repository<Subscription>;

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
    const email = `e2e-offers-${Date.now()}-${emailCounter}@example.com`;
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
  ): Promise<{ subscriptionId: string }> {
    const res = await request(app.getHttpServer())
      .post(path('/companies'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name, ice: nextIce() })
      .expect(201);
    return {
      subscriptionId: (res.body as { subscription: { id: string } })
        .subscription.id,
    };
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
    subscriptionRepo = app.get(getRepositoryToken(Subscription));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario 1 — cycle de vie complet (création → modération → clôture)', () => {
    it('walks a job offer through pending_moderation -> published -> closed', async () => {
      const recruiter = await createVerifiedUser();
      await createCompanyFor(recruiter.token);
      const recruiterToken = await freshToken(recruiter.userId);

      const createRes = await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ title: 'Senior Backend Engineer' })
        .expect(201);
      const offer = createRes.body as { id: string; status: string };
      expect(offer.status).toBe('pending_moderation');

      const moderator = await createVerifiedUser([Role.MODERATOR]);
      const approveRes = await request(app.getHttpServer())
        .patch(path(`/companies/offers/${offer.id}/moderate`))
        .set('Authorization', `Bearer ${moderator.token}`)
        .send({ decision: 'approve' })
        .expect(200);
      expect((approveRes.body as { status: string }).status).toBe('published');

      const closeRes = await request(app.getHttpServer())
        .patch(path(`/companies/offers/${offer.id}/close`))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);
      expect((closeRes.body as { status: string }).status).toBe('closed');
    });

    it('rejects re-closing a non-published offer', async () => {
      const recruiter = await createVerifiedUser();
      await createCompanyFor(recruiter.token);
      const recruiterToken = await freshToken(recruiter.userId);

      const createRes = await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ title: 'Still pending offer' })
        .expect(201);
      const offer = createRes.body as { id: string };

      await request(app.getHttpServer())
        .patch(path(`/companies/offers/${offer.id}/close`))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(409);
    });
  });

  describe('Scenario 2 — RBAC : la modération est réservée admin/moderator', () => {
    it('rejects moderation attempted by a plain recruiter', async () => {
      const recruiter = await createVerifiedUser();
      await createCompanyFor(recruiter.token);
      const recruiterToken = await freshToken(recruiter.userId);

      const createRes = await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ title: 'Cannot self-moderate' })
        .expect(201);
      const offer = createRes.body as { id: string };

      await request(app.getHttpServer())
        .patch(path(`/companies/offers/${offer.id}/moderate`))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ decision: 'approve' })
        .expect(403);
    });
  });

  describe('Scenario 3 — isolation stricte entre entreprises', () => {
    it("does not let a recruiter close another company's offer", async () => {
      const recruiterA = await createVerifiedUser();
      await createCompanyFor(recruiterA.token, 'Company A');
      const recruiterAToken = await freshToken(recruiterA.userId);

      const createRes = await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({ title: 'Company A offer' })
        .expect(201);
      const offer = createRes.body as { id: string };

      const moderator = await createVerifiedUser([Role.MODERATOR]);
      await request(app.getHttpServer())
        .patch(path(`/companies/offers/${offer.id}/moderate`))
        .set('Authorization', `Bearer ${moderator.token}`)
        .send({ decision: 'approve' })
        .expect(200);

      const recruiterB = await createVerifiedUser();
      await createCompanyFor(recruiterB.token, 'Company B');
      const recruiterBToken = await freshToken(recruiterB.userId);

      await request(app.getHttpServer())
        .patch(path(`/companies/offers/${offer.id}/close`))
        .set('Authorization', `Bearer ${recruiterBToken}`)
        .expect(404);

      const listRes = await request(app.getHttpServer())
        .get(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiterBToken}`)
        .expect(200);
      const listBody = listRes.body as Array<{ id: string }>;
      expect(listBody.map((o) => o.id)).not.toContain(offer.id);
    });
  });

  describe('Scenario 4 — garde-fou : abonnement expiré bloque la création', () => {
    it('rejects creating an offer once the trial subscription has expired', async () => {
      const recruiter = await createVerifiedUser();
      const { subscriptionId } = await createCompanyFor(recruiter.token);
      const recruiterToken = await freshToken(recruiter.userId);

      await subscriptionRepo.update(
        { id: subscriptionId },
        { endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      );

      await request(app.getHttpServer())
        .post(path('/companies/offers'))
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ title: 'Should be rejected' })
        .expect(403);
    });
  });
});
