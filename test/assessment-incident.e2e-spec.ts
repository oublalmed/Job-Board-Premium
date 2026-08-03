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
import { Specialty } from '../src/modules/assessments/entities/specialty.entity';
import { Test as TestEntity } from '../src/modules/assessments/entities/test.entity';

// Regression coverage for a real bug found building Front 1's session
// screen: freshly-started assessments were created PENDING, and nothing
// ever transitioned them to IN_PROGRESS — reportIncident (which requires
// IN_PROGRESS) was structurally unreachable for any assessment that had
// never already had an incident. No e2e coverage existed for this
// endpoint at all before this fix (grepped, confirmed empty) — this is
// why the unit suite's IN_PROGRESS-mocked fixtures never caught it.
describe('POST /assessments/:id/incident (e2e)', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let specialtyRepo: Repository<Specialty>;
  let testRepo: Repository<TestEntity>;

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  async function createCandidate(): Promise<{ userId: string; token: string }> {
    const user = await userRepo.save(
      userRepo.create({
        email: `e2e-incident-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
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

    await app.init();

    jwtService = app.get(JwtService);
    userRepo = app.get(getRepositoryToken(User));
    specialtyRepo = app.get(getRepositoryToken(Specialty));
    testRepo = app.get(getRepositoryToken(TestEntity));
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts an incident on an assessment exactly as POST /assessments/start created it, then allows resume', async () => {
    const candidate = await createCandidate();
    const specialty = await specialtyRepo.save(
      specialtyRepo.create({
        name: `E2E incident specialty ${Date.now()}`,
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

    const startRes = await request(app.getHttpServer())
      .post(path('/assessments/start'))
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({ testId: test.id })
      .expect(201);
    const { id: assessmentId, status: statusAfterStart } = (
      startRes.body as { assessment: { id: string; status: string } }
    ).assessment;
    expect(statusAfterStart).toBe('in_progress');

    const incidentRes = await request(app.getHttpServer())
      .post(path(`/assessments/${assessmentId}/incident`))
      .set('Authorization', `Bearer ${candidate.token}`)
      .expect(201);
    const afterIncident = incidentRes.body as {
      status: string;
      resumeToken: string;
    };
    expect(afterIncident.status).toBe('incident');
    expect(afterIncident.resumeToken).toBeDefined();

    const resumeRes = await request(app.getHttpServer())
      .post(path('/assessments/resume'))
      .set('Authorization', `Bearer ${candidate.token}`)
      .send({ assessmentId, resumeToken: afterIncident.resumeToken })
      .expect(201);
    const afterResume = (resumeRes.body as { assessment: { status: string } })
      .assessment;
    expect(afterResume.status).toBe('in_progress');
  });

  it('rejects an incident on someone else’s assessment (isolation)', async () => {
    const candidateA = await createCandidate();
    const candidateB = await createCandidate();
    const specialty = await specialtyRepo.save(
      specialtyRepo.create({
        name: `E2E incident isolation specialty ${Date.now()}`,
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

    const startRes = await request(app.getHttpServer())
      .post(path('/assessments/start'))
      .set('Authorization', `Bearer ${candidateA.token}`)
      .send({ testId: test.id })
      .expect(201);
    const assessmentId = (startRes.body as { assessment: { id: string } })
      .assessment.id;

    await request(app.getHttpServer())
      .post(path(`/assessments/${assessmentId}/incident`))
      .set('Authorization', `Bearer ${candidateB.token}`)
      .expect(403);
  });
});
