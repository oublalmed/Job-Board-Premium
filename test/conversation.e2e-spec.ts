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
import { CandidateProfile } from '../src/modules/candidates/entities/candidate-profile.entity';
import { Subscription } from '../src/modules/companies/entities/subscription.entity';
import { Role } from '../src/common/enums/role.enum';
import { ConversationService } from '../src/modules/messaging/conversation.service';
import { Conversation } from '../src/modules/messaging/entities/conversation.entity';
import { Message } from '../src/modules/messaging/entities/message.entity';
import { ContactQuotaExceededException } from '../src/modules/companies/contact-quota.exceptions';

describe('Conversations (e2e) — Lot 5B, ouverture de fil transactionnelle', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let profileRepo: Repository<CandidateProfile>;
  let subscriptionRepo: Repository<Subscription>;
  let conversationRepo: Repository<Conversation>;
  let conversationService: ConversationService;

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
    const email = `e2e-conv-${Date.now()}-${emailCounter}@example.com`;
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

  function path(p: string): string {
    return `/${apiPrefix}${p}`;
  }

  async function createCompanyFor(
    token: string,
    name = 'Acme Corp',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(path('/companies'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name, ice: nextIce() })
      .expect(201);
    return (res.body as { company: { id: string } }).company.id;
  }

  async function createCandidateProfile(): Promise<string> {
    const candidate = await createVerifiedUser([Role.CANDIDATE]);
    const profile = await profileRepo.save(
      profileRepo.create({
        userId: candidate.userId,
        headline: 'Senior backend engineer',
      }),
    );
    return profile.id;
  }

  async function setQuota(
    companyId: string,
    contactQuota: number,
    contactsUsed: number,
  ): Promise<void> {
    await subscriptionRepo.update(
      { companyId },
      { contactQuota, contactsUsed },
    );
  }

  async function readContactsUsed(companyId: string): Promise<number> {
    const subscription = await subscriptionRepo.findOne({
      where: { companyId },
    });
    return subscription!.contactsUsed;
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
    subscriptionRepo = app.get(getRepositoryToken(Subscription));
    conversationRepo = app.get(getRepositoryToken(Conversation));
    conversationService = app.get(ConversationService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Scenario 1 — ouverture nominale', () => {
    it('creates the conversation + first message and decrements the quota by exactly 1', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const candidateProfileId = await createCandidateProfile();

      const before = await readContactsUsed(companyId);

      const res = await request(app.getHttpServer())
        .post(path('/conversations'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ candidateProfileId, message: 'Bonjour, votre profil nous intéresse' })
        .expect(201);

      const body = res.body as { id: string; candidateId: string; companyId: string };
      expect(body.candidateId).toBe(candidateProfileId);
      expect(body.companyId).toBe(companyId);

      const after = await readContactsUsed(companyId);
      expect(after).toBe(before + 1);
    });

    it('rejects a candidate trying to open a conversation (only recruiters may initiate)', async () => {
      const candidate = await createVerifiedUser([Role.CANDIDATE]);
      const recruiter = await createVerifiedUser();
      await createCompanyFor(recruiter.token);
      const candidateProfileId = await createCandidateProfile();

      await request(app.getHttpServer())
        .post(path('/conversations'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ candidateProfileId, message: 'hi' })
        .expect(403);
    });
  });

  describe('Scenario 2 — atomicité (échec de création du fil après le décrément)', () => {
    it('rolls back the quota decrement when the Message insert fails inside the same transaction', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const candidateProfileId = await createCandidateProfile();

      const before = await readContactsUsed(companyId);

      // Force a real failure on the Message insert, inside the real
      // transaction, against the real DataSource — not a fully mocked
      // service. Repository.prototype.save is patched process-wide but
      // scoped to entities targeting Message, and restored immediately
      // after, so it only affects this one call.
      const originalSave = Repository.prototype.save;
      const saveSpy = jest
        .spyOn(Repository.prototype, 'save')
        .mockImplementation(function (
          this: Repository<unknown>,
          ...args: unknown[]
        ) {
          if (this.metadata.target === Message) {
            return Promise.reject(
              new Error('simulated failure inserting the first message'),
            );
          }
          return (
            originalSave as (...a: unknown[]) => unknown
          ).apply(this, args) as Promise<unknown>;
        });

      try {
        await expect(
          conversationService.openConversation(
            recruiter.userId,
            candidateProfileId,
            'hi',
          ),
        ).rejects.toThrow('simulated failure inserting the first message');
      } finally {
        saveSpy.mockRestore();
      }

      const after = await readContactsUsed(companyId);
      expect(after).toBe(before);

      const conversation = await conversationRepo.findOne({
        where: { candidateId: candidateProfileId, companyId },
      });
      expect(conversation).toBeNull();
    });
  });

  describe('Scenario 3 — idempotence structurelle sous concurrence', () => {
    it('two parallel opens of the same (candidate, company) pair yield exactly one conversation and exactly one quota decrement', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const candidateProfileId = await createCandidateProfile();

      const before = await readContactsUsed(companyId);

      const results = await Promise.allSettled([
        conversationService.openConversation(
          recruiter.userId,
          candidateProfileId,
          'Premier message A',
        ),
        conversationService.openConversation(
          recruiter.userId,
          candidateProfileId,
          'Premier message B',
        ),
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      const conversations = results
        .filter(
          (r): r is PromiseFulfilledResult<Conversation> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value.id);
      expect(new Set(conversations).size).toBe(1);

      const rows = await conversationRepo.find({
        where: { candidateId: candidateProfileId, companyId },
      });
      expect(rows).toHaveLength(1);

      const after = await readContactsUsed(companyId);
      expect(after).toBe(before + 1);
    });
  });

  describe('Scenario 4 — quota épuisé', () => {
    it('fails with ContactQuotaExceededException and creates no conversation', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const candidateProfileId = await createCandidateProfile();

      await setQuota(companyId, 5, 5);

      await expect(
        conversationService.openConversation(
          recruiter.userId,
          candidateProfileId,
          'hi',
        ),
      ).rejects.toThrow(ContactQuotaExceededException);

      const conversation = await conversationRepo.findOne({
        where: { candidateId: candidateProfileId, companyId },
      });
      expect(conversation).toBeNull();
    });
  });

  describe('Scenario 5 — sendMessage ne consomme aucun quota', () => {
    it('leaves contacts_used unchanged after sending a message on an existing thread', async () => {
      const recruiter = await createVerifiedUser();
      const companyId = await createCompanyFor(recruiter.token);
      const candidateProfileId = await createCandidateProfile();

      const conversation = await conversationService.openConversation(
        recruiter.userId,
        candidateProfileId,
        'Premier message',
      );
      const afterOpen = await readContactsUsed(companyId);

      await request(app.getHttpServer())
        .post(path(`/conversations/${conversation.id}/messages`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ body: 'Un deuxième message' })
        .expect(201);

      const afterMessage = await readContactsUsed(companyId);
      expect(afterMessage).toBe(afterOpen);
    });
  });

  describe('Scenario 6 — isolation cross-entreprise', () => {
    it("does not let a recruiter from company B write into company A's thread (404)", async () => {
      const recruiterA = await createVerifiedUser();
      const companyIdA = await createCompanyFor(recruiterA.token, 'Company A');
      const candidateProfileId = await createCandidateProfile();

      const conversation = await conversationService.openConversation(
        recruiterA.userId,
        candidateProfileId,
        'Premier message',
      );

      const recruiterB = await createVerifiedUser();
      await createCompanyFor(recruiterB.token, 'Company B');

      await request(app.getHttpServer())
        .post(path(`/conversations/${conversation.id}/messages`))
        .set('Authorization', `Bearer ${recruiterB.token}`)
        .send({ body: 'Intrusion' })
        .expect(404);

      // Confirms companyIdA's thread and quota are untouched by the attempt.
      const rows = await conversationRepo.find({
        where: { id: conversation.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].companyId).toBe(companyIdA);
    });
  });
});
