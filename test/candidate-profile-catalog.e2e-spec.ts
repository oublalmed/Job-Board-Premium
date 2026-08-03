import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';
import { Specialty } from '../src/modules/assessments/entities/specialty.entity';
import { Test as TestEntity } from '../src/modules/assessments/entities/test.entity';
import {
  Assessment,
  AssessmentStatus,
} from '../src/modules/assessments/entities/assessment.entity';
import { Skill } from '../src/modules/candidates/entities/skill.entity';
import { ExperienceType } from '../src/modules/candidates/entities/experience.entity';
import { LinkType } from '../src/modules/candidates/entities/profile-link.entity';

// Front 1 backend prerequisites: referential listing (specialties/tests/
// skills) and Experience/ProfileLink/ProfileSkill CRUD — none of this
// existed before (entities only, no controllers). See PROGRESS.md.
describe('Front 1 backend prerequisites (e2e)', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let webhookSecret: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let specialtyRepo: Repository<Specialty>;
  let testRepo: Repository<TestEntity>;
  let assessmentRepo: Repository<Assessment>;
  let skillRepo: Repository<Skill>;

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  function sign(body: Buffer): string {
    return createHmac('sha256', webhookSecret).update(body).digest('hex');
  }

  async function createCandidate(): Promise<{ userId: string; token: string }> {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-front1-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles: [Role.CANDIDATE],
        emailVerified: true,
      }),
    );
    const token = jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });
    return { userId: user.id, token };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
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
    webhookSecret = configService.get<string>('scoring.webhookSecret', '');

    await app.init();

    jwtService = app.get(JwtService);
    userRepo = app.get(getRepositoryToken(User));
    specialtyRepo = app.get(getRepositoryToken(Specialty));
    testRepo = app.get(getRepositoryToken(TestEntity));
    assessmentRepo = app.get(getRepositoryToken(Assessment));
    skillRepo = app.get(getRepositoryToken(Skill));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /specialties, GET /tests — catalog', () => {
    it('lists active specialties and tests without leaking vendor fields', async () => {
      const candidate = await createCandidate();
      const specialty = await specialtyRepo.save(
        specialtyRepo.create({
          name: `E2E catalog specialty ${Date.now()}`,
          active: true,
        }),
      );
      await testRepo.save(
        testRepo.create({
          specialtyId: specialty.id,
          version: '1.0',
          provider: 'secret-vendor',
          externalTestId: 'secret-external-id',
          durationMinutes: 45,
          active: true,
        }),
      );

      const specialtiesRes = await request(app.getHttpServer())
        .get(path('/specialties'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      const found = (
        specialtiesRes.body as { id: string; name: string }[]
      ).find((s) => s.id === specialty.id);
      expect(found).toBeDefined();

      const testsRes = await request(app.getHttpServer())
        .get(path(`/tests?specialtyId=${specialty.id}`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      const tests = testsRes.body as {
        id: string;
        specialtyId: string;
        durationMinutes: number;
      }[];
      expect(tests.length).toBe(1);
      expect(tests[0]).not.toHaveProperty('provider');
      expect(tests[0]).not.toHaveProperty('externalTestId');
      expect(typeof tests[0].id).toBe('string');
      expect(tests[0].specialtyId).toBe(specialty.id);
      expect(tests[0].durationMinutes).toBe(45);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get(path('/specialties')).expect(401);
    });
  });

  describe('GET /skills — catalog', () => {
    it('lists only active skills', async () => {
      const candidate = await createCandidate();
      const activeSkill = await skillRepo.save(
        skillRepo.create({
          name: `E2E skill active ${Date.now()}`,
          active: true,
        }),
      );
      const inactiveSkill = await skillRepo.save(
        skillRepo.create({
          name: `E2E skill inactive ${Date.now()}`,
          active: false,
        }),
      );

      const res = await request(app.getHttpServer())
        .get(path('/skills'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);

      const ids = (res.body as { id: string }[]).map((s) => s.id);
      expect(ids).toContain(activeSkill.id);
      expect(ids).not.toContain(inactiveSkill.id);
    });
  });

  describe('/candidates/experiences CRUD', () => {
    it('creates, lists, updates, deletes — and moves the completeness gauge', async () => {
      const candidate = await createCandidate();

      // Auto-creates the profile row on first touch — getCompleteness
      // itself 404s until a profile exists (already covered by
      // candidate-profile.controller.spec.ts), matching the real
      // frontend flow where GET /candidates/profile runs first.
      await request(app.getHttpServer())
        .get(path('/candidates/profile'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);

      const before = await request(app.getHttpServer())
        .get(path('/candidates/profile/completeness'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      expect(
        (before.body as { missing: { key: string }[] }).missing.some(
          (m) => m.key === 'experience',
        ),
      ).toBe(true);

      const created = await request(app.getHttpServer())
        .post(path('/candidates/experiences'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({
          type: ExperienceType.WORK,
          title: 'Backend developer',
          organization: 'Acme',
          startDate: '2020-01-01',
        })
        .expect(201);
      const experienceId = (created.body as { id: string }).id;

      const after = await request(app.getHttpServer())
        .get(path('/candidates/profile/completeness'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      expect(
        (after.body as { missing: { key: string }[] }).missing.some(
          (m) => m.key === 'experience',
        ),
      ).toBe(false);
      expect(
        (after.body as { completeness: number }).completeness,
      ).toBeGreaterThan((before.body as { completeness: number }).completeness);

      const list = await request(app.getHttpServer())
        .get(path('/candidates/experiences'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      expect((list.body as { id: string }[]).map((e) => e.id)).toContain(
        experienceId,
      );

      await request(app.getHttpServer())
        .put(path(`/candidates/experiences/${experienceId}`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ title: 'Senior backend developer' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(path(`/candidates/experiences/${experienceId}`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);

      const finalCompleteness = await request(app.getHttpServer())
        .get(path('/candidates/profile/completeness'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      expect(
        (finalCompleteness.body as { missing: { key: string }[] }).missing.some(
          (m) => m.key === 'experience',
        ),
      ).toBe(true);
    });

    it('candidate B cannot update or delete candidate A’s experience — 404', async () => {
      const candidateA = await createCandidate();
      const candidateB = await createCandidate();

      const created = await request(app.getHttpServer())
        .post(path('/candidates/experiences'))
        .set('Authorization', `Bearer ${candidateA.token}`)
        .send({
          type: ExperienceType.EDUCATION,
          title: 'MSc',
          organization: 'Uni',
          startDate: '2018-09-01',
        })
        .expect(201);
      const experienceId = (created.body as { id: string }).id;

      await request(app.getHttpServer())
        .put(path(`/candidates/experiences/${experienceId}`))
        .set('Authorization', `Bearer ${candidateB.token}`)
        .send({ title: 'hijacked' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(path(`/candidates/experiences/${experienceId}`))
        .set('Authorization', `Bearer ${candidateB.token}`)
        .expect(404);
    });
  });

  describe('/candidates/links CRUD', () => {
    it('rejects an invalid URL (server-side validation, not just front)', async () => {
      const candidate = await createCandidate();

      await request(app.getHttpServer())
        .post(path('/candidates/links'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ type: LinkType.GITHUB, url: 'not-a-url' })
        .expect(400);
    });

    it('creates, lists, and deletes a link', async () => {
      const candidate = await createCandidate();

      const created = await request(app.getHttpServer())
        .post(path('/candidates/links'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({
          type: LinkType.PORTFOLIO,
          url: 'https://example.com/portfolio',
        })
        .expect(201);
      const linkId = (created.body as { id: string }).id;

      const list = await request(app.getHttpServer())
        .get(path('/candidates/links'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      expect((list.body as { id: string }[]).map((l) => l.id)).toContain(
        linkId,
      );

      await request(app.getHttpServer())
        .delete(path(`/candidates/links/${linkId}`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
    });
  });

  describe('/candidates/skills add/remove', () => {
    it('rejects a nonexistent skillId', async () => {
      const candidate = await createCandidate();

      await request(app.getHttpServer())
        .post(path('/candidates/skills'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ skillId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('adds a skill, rejects a duplicate with 409, removes it', async () => {
      const candidate = await createCandidate();
      const skill = await skillRepo.save(
        skillRepo.create({ name: `E2E dup-skill ${Date.now()}`, active: true }),
      );

      const added = await request(app.getHttpServer())
        .post(path('/candidates/skills'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ skillId: skill.id, level: 'expert' })
        .expect(201);
      const profileSkillId = (added.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(path('/candidates/skills'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ skillId: skill.id })
        .expect(409);

      await request(app.getHttpServer())
        .delete(path(`/candidates/skills/${profileSkillId}`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
    });
  });

  describe('POST /assessments/start — cooldown 409 now carries reEligibleAt', () => {
    it('exposes a structured reEligibleAt in the real HTTP error body', async () => {
      const candidate = await createCandidate();
      const specialty = await specialtyRepo.save(
        specialtyRepo.create({
          name: `E2E cooldown specialty ${Date.now()}`,
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

      const externalId = `e2e-cooldown-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const priorAssessment = await assessmentRepo.save(
        assessmentRepo.create({
          candidateId: candidate.userId,
          testId: test.id,
          externalAssessmentId: externalId,
          status: AssessmentStatus.IN_PROGRESS,
          startedAt: new Date(),
        }),
      );
      const payload = Buffer.from(JSON.stringify({ externalId }));
      await request(app.getHttpServer())
        .post(path('/assessments/webhook'))
        .set('Content-Type', 'application/json')
        .set('x-scoring-signature', sign(payload))
        .send(payload.toString('utf8'))
        .expect(200);
      // Freshly completed → still well within the 90-day cooldown window.
      await assessmentRepo.update(priorAssessment.id, {
        completedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post(path('/assessments/start'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ testId: test.id })
        .expect(409);

      expect(
        (res.body as { reEligibleAt?: string }).reEligibleAt,
      ).toBeDefined();
      expect(
        new Date((res.body as { reEligibleAt: string }).reEligibleAt).getTime(),
      ).toBeGreaterThan(Date.now());
    });
  });
});
