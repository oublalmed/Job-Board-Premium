import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { Score } from '../src/modules/assessments/entities/score.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';

describe('POST /assessments/webhook (e2e)', () => {
  let app: INestApplication<App>;
  let webhookSecret: string;
  let apiPrefix: string;
  let userRepo: Repository<User>;
  let specialtyRepo: Repository<Specialty>;
  let testRepo: Repository<TestEntity>;
  let assessmentRepo: Repository<Assessment>;
  let scoreRepo: Repository<Score>;

  const externalId = `e2e-ext-${Date.now()}`;
  const payload = Buffer.from(JSON.stringify({ externalId }));
  // supertest/superagent JSON-serializes any non-string body when
  // Content-Type is application/json (even a Buffer), which would corrupt
  // the exact bytes the server needs to verify the signature against.
  // Sending the same bytes as a string bypasses that auto-serialization.
  const payloadOnWire = payload.toString('utf8');

  function sign(body: Buffer): string {
    return createHmac('sha256', webhookSecret).update(body).digest('hex');
  }

  function webhookPath(): string {
    return `/${apiPrefix}/assessments/webhook`;
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

    if (!webhookSecret) {
      throw new Error(
        'SCORING_WEBHOOK_SECRET must be set to run this e2e suite (it validates real HMAC verification).',
      );
    }

    userRepo = app.get(getRepositoryToken(User));
    specialtyRepo = app.get(getRepositoryToken(Specialty));
    testRepo = app.get(getRepositoryToken(TestEntity));
    assessmentRepo = app.get(getRepositoryToken(Assessment));
    scoreRepo = app.get(getRepositoryToken(Score));

    const candidate = await userRepo.save(
      userRepo.create({
        email: `e2e-webhook-${Date.now()}@example.com`,
        passwordHash: 'irrelevant-for-this-test',
        roles: [Role.CANDIDATE],
        emailVerified: true,
      }),
    );

    const specialty = await specialtyRepo.save(
      specialtyRepo.create({
        name: `E2E specialty ${Date.now()}`,
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

    await assessmentRepo.save(
      assessmentRepo.create({
        candidateId: candidate.id,
        testId: test.id,
        externalAssessmentId: externalId,
        status: AssessmentStatus.IN_PROGRESS,
        startedAt: new Date(),
      }),
    );
  });

  afterAll(async () => {
    const assessment = await assessmentRepo.findOne({
      where: { externalAssessmentId: externalId },
    });
    if (assessment) {
      await scoreRepo.delete({ assessmentId: assessment.id });
      await assessmentRepo.delete({ id: assessment.id });
    }
    await app.close();
  });

  it('(a) rejects a call with no signature header', async () => {
    await request(app.getHttpServer())
      .post(webhookPath())
      .set('Content-Type', 'application/json')
      .send(payloadOnWire)
      .expect(403);
  });

  it('(b) rejects a call with a wrong signature', async () => {
    await request(app.getHttpServer())
      .post(webhookPath())
      .set('Content-Type', 'application/json')
      .set('x-scoring-signature', 'this-is-not-the-right-signature')
      .send(payloadOnWire)
      .expect(403);
  });

  it('(c) accepts a correctly signed payload and persists a score', async () => {
    const signature = sign(payload);

    const response = await request(app.getHttpServer())
      .post(webhookPath())
      .set('Content-Type', 'application/json')
      .set('x-scoring-signature', signature)
      .send(payloadOnWire)
      .expect(200);

    const body = response.body as { alreadyProcessed: boolean };
    expect(body.alreadyProcessed).toBe(false);

    const assessment = await assessmentRepo.findOne({
      where: { externalAssessmentId: externalId },
    });
    const persistedScore = await scoreRepo.findOne({
      where: { assessmentId: assessment!.id },
    });
    expect(persistedScore).not.toBeNull();
  });

  it('replaying the same correctly signed payload is idempotent', async () => {
    const signature = sign(payload);

    const response = await request(app.getHttpServer())
      .post(webhookPath())
      .set('Content-Type', 'application/json')
      .set('x-scoring-signature', signature)
      .send(payloadOnWire)
      .expect(200);

    const body = response.body as { alreadyProcessed: boolean };
    expect(body.alreadyProcessed).toBe(true);
  });
});
