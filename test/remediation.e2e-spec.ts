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
import { Specialty } from '../src/modules/assessments/entities/specialty.entity';
import { Test as TestEntity } from '../src/modules/assessments/entities/test.entity';
import {
  Assessment,
  AssessmentStatus,
} from '../src/modules/assessments/entities/assessment.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';

describe('GET /assessments/:id/feedback (e2e) — Lot 7 remediation', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let webhookSecret: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let specialtyRepo: Repository<Specialty>;
  let testRepo: Repository<TestEntity>;
  let assessmentRepo: Repository<Assessment>;

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  function sign(body: Buffer): string {
    return createHmac('sha256', webhookSecret).update(body).digest('hex');
  }

  async function createCandidate(): Promise<{ userId: string; token: string }> {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-remediation-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
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
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCompletedAssessment(
    candidateId: string,
  ): Promise<string> {
    const specialty = await specialtyRepo.save(
      specialtyRepo.create({
        name: `E2E remediation specialty ${Date.now()}-${Math.random()}`,
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
    const externalId = `e2e-rem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const assessment = await assessmentRepo.save(
      assessmentRepo.create({
        candidateId,
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

    return assessment.id;
  }

  it('returns per-domain feedback with no leaked keys for the assessment owner', async () => {
    const candidate = await createCandidate();
    const assessmentId = await createCompletedAssessment(candidate.userId);

    const res = await request(app.getHttpServer())
      .get(path(`/assessments/${assessmentId}/feedback`))
      .set('Authorization', `Bearer ${candidate.token}`)
      .expect(200);

    const body = res.body as {
      scoreValue: number;
      indexationThresholdMet: boolean;
      domainFeedback: { domain: string; level: string }[];
      resources: unknown[];
      reEligibleAt: string;
    };

    expect(body.scoreValue).toBe(65); // StubScoringAdapter's fixed score
    expect(body.domainFeedback.length).toBeGreaterThan(0);
    for (const entry of body.domainFeedback) {
      expect(Object.keys(entry).sort()).toEqual(['domain', 'level']);
    }
    expect(body.reEligibleAt).toBeDefined();
  });

  it('does not let candidate B see candidate A’s feedback — 404, not 403 (existence not leaked)', async () => {
    const candidateA = await createCandidate();
    const candidateB = await createCandidate();
    const assessmentId = await createCompletedAssessment(candidateA.userId);

    await request(app.getHttpServer())
      .get(path(`/assessments/${assessmentId}/feedback`))
      .set('Authorization', `Bearer ${candidateB.token}`)
      .expect(404);

    // Confirmed still reachable by its actual owner — proves the 404 above
    // is an isolation result, not a broken endpoint.
    await request(app.getHttpServer())
      .get(path(`/assessments/${assessmentId}/feedback`))
      .set('Authorization', `Bearer ${candidateA.token}`)
      .expect(200);
  });

  it('rejects an unauthenticated request', async () => {
    const candidate = await createCandidate();
    const assessmentId = await createCompletedAssessment(candidate.userId);

    await request(app.getHttpServer())
      .get(path(`/assessments/${assessmentId}/feedback`))
      .expect(401);
  });

  it('rejects a recruiter (wrong role) even if authenticated', async () => {
    const candidate = await createCandidate();
    const assessmentId = await createCompletedAssessment(candidate.userId);

    const recruiterUser = await userRepo.save(
      userRepo.create({
        email: `e2e-remediation-recruiter-${Date.now()}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles: [Role.RECRUITER],
        emailVerified: true,
      }),
    );
    const recruiterToken = jwtService.sign({
      sub: recruiterUser.id,
      email: recruiterUser.email,
      roles: recruiterUser.roles,
    });

    await request(app.getHttpServer())
      .get(path(`/assessments/${assessmentId}/feedback`))
      .set('Authorization', `Bearer ${recruiterToken}`)
      .expect(403);
  });
});
