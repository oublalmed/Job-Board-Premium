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

describe('Companies (e2e) — EF-RECR-01', () => {
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
    emailVerified = true,
  ): Promise<{ userId: string; token: string }> {
    emailCounter += 1;
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-company-${Date.now()}-${emailCounter}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles,
        emailVerified,
      }),
    );
    const token = jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });
    return { userId: user.id, token };
  }

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
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

  describe('Scenario 1 — création nominale + boucle Lot 3 (sans seed SQL)', () => {
    it('creates a company, promotes the caller to company_admin, provisions an active trial, and unlocks /search/candidates', async () => {
      const { userId, token } = await createVerifiedUser();
      const ice = nextIce();

      const createRes = await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme Corp', ice })
        .expect(201);

      const createBody = createRes.body as {
        company: { id: string; ice: string };
        subscription: { status: string; endsAt: string };
      };
      expect(createBody.company.ice).toBe(ice);
      expect(createBody.subscription.status).toBe('trial');
      expect(
        new Date(createBody.subscription.endsAt).getTime(),
      ).toBeGreaterThan(Date.now());

      const meRes = await request(app.getHttpServer())
        .get(path('/companies/me'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const meBody = meRes.body as { company: { id: string } };
      expect(meBody.company.id).toBe(createBody.company.id);

      const meUser = await userRepo.findOne({ where: { id: userId } });
      expect(meUser?.roles).toContain(Role.COMPANY_ADMIN);

      // The Lot 3 search gate must now pass for real — company, recruiter and
      // an active trial subscription were all created through the real flow,
      // no manual SQL seed.
      await request(app.getHttpServer())
        .get(path('/search/candidates'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('Scenario 2 — ICE déjà utilisé', () => {
    it('rejects with 409 when a company with this ICE already exists', async () => {
      const owner = await createVerifiedUser();
      const ice = nextIce();
      await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name: 'First Co', ice })
        .expect(201);

      const challenger = await createVerifiedUser();
      await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${challenger.token}`)
        .send({ name: 'Copycat Co', ice })
        .expect(409);
    });
  });

  describe('Scenario 3 — email professionnel non vérifié', () => {
    it('rejects with 403 when the caller email is not verified', async () => {
      const { token } = await createVerifiedUser([Role.RECRUITER], false);

      await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Unverified Co', ice: nextIce() })
        .expect(403);
    });
  });

  describe('Scenario 4 — déjà rattaché à une entreprise', () => {
    it('rejects with 409 on a second company creation by the same user', async () => {
      const { token } = await createVerifiedUser();
      await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'First Company', ice: nextIce() })
        .expect(201);

      await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Second Company', ice: nextIce() })
        .expect(409);
    });
  });

  describe('Scenario 5 — format ICE invalide', () => {
    it('rejects with 400 when ICE is not exactly 15 digits', async () => {
      const { token } = await createVerifiedUser();

      await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad ICE Co', ice: '12345' })
        .expect(400);
    });
  });

  describe('Scenario 6 — GET /companies/me sans entreprise', () => {
    it('returns 404, not a crash, when the user has no company', async () => {
      const { token } = await createVerifiedUser();

      await request(app.getHttpServer())
        .get(path('/companies/me'))
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Scenario 7 — garde-fou : un trial expiré coupe /search/candidates', () => {
    it('returns 403 once the real trial subscription has expired', async () => {
      const { token } = await createVerifiedUser();
      const createRes = await request(app.getHttpServer())
        .post(path('/companies'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Soon Expired Co', ice: nextIce() })
        .expect(201);

      const createBody = createRes.body as {
        subscription: { id: string };
      };

      // Created through the real flow above; now push its real endsAt into
      // the past directly, instead of faking trial_duration_days at creation
      // time — this proves the gate reacts to actual expired data.
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await subscriptionRepo.update(
        { id: createBody.subscription.id },
        { endsAt: past },
      );

      await request(app.getHttpServer())
        .get(path('/search/candidates'))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
