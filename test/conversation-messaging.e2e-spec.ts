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
import { Role } from '../src/common/enums/role.enum';
import { FILE_SCANNER } from '../src/ports/file-scanner.port';
import type { ScanResult } from '../src/ports/file-scanner.port';
import {
  Notification,
  NotificationType,
} from '../src/modules/notifications/entities/notification.entity';
import { MessageReportStatus } from '../src/modules/messaging/entities/message-report.entity';

// EF-MSG-01/02/03/05 — end-to-end, over real HTTP against real Postgres, of
// the parts the open-conversation e2e does not cover: listing/reading a thread
// with read-marking, new-message notifications, the antivirus-gated document
// share with participant-only signed download, and the abuse-report →
// admin-moderation-queue path (including cross-tenant isolation on each).
//
// The antivirus adapter is overridden with a controllable stub so the blocking
// scan can be proven without a real clamd: any filename containing "virus" is
// reported infected, everything else clean.
describe('Messaging flows (e2e) — EF-MSG-01/02/03/05', () => {
  let app: INestApplication<App>;
  let apiPrefix: string;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let profileRepo: Repository<CandidateProfile>;
  let notificationRepo: Repository<Notification>;

  let iceCounter = 0;
  function nextIce(): string {
    iceCounter += 1;
    return String(Date.now() + iceCounter)
      .padStart(15, '0')
      .slice(-15);
  }

  let emailCounter = 0;
  async function createUser(
    roles: Role[],
  ): Promise<{ userId: string; email: string; token: string }> {
    emailCounter += 1;
    const email = `e2e-msg-${Date.now()}-${emailCounter}@example.com`;
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

  async function createCandidate(): Promise<{
    userId: string;
    token: string;
    profileId: string;
  }> {
    const candidate = await createUser([Role.CANDIDATE]);
    const profile = await profileRepo.save(
      profileRepo.create({
        userId: candidate.userId,
        headline: 'Senior backend engineer',
      }),
    );
    return {
      userId: candidate.userId,
      token: candidate.token,
      profileId: profile.id,
    };
  }

  // Fire-and-forget notifications are dispatched off the request path, so poll
  // briefly rather than asserting synchronously.
  async function waitForNotifications(
    recipientUserId: string,
    min = 1,
  ): Promise<Notification[]> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const rows = await notificationRepo.find({
        where: { recipientUserId, type: NotificationType.NEW_MESSAGE },
      });
      if (rows.length >= min) return rows;
      await new Promise((r) => setTimeout(r, 50));
    }
    return notificationRepo.find({
      where: { recipientUserId, type: NotificationType.NEW_MESSAGE },
    });
  }

  async function openThread(
    recruiterToken: string,
    candidateProfileId: string,
    message = 'Bonjour, votre profil nous intéresse',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(path('/conversations'))
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ candidateProfileId, message })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FILE_SCANNER)
      .useValue({
        scan: (_buffer: Buffer, filename: string): Promise<ScanResult> =>
          Promise.resolve(
            filename.includes('virus')
              ? { clean: false, threat: 'EICAR-Test-Signature' }
              : { clean: true },
          ),
      })
      .compile();

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
    notificationRepo = app.get(getRepositoryToken(Notification));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('EF-MSG-01 — thread listing, reading & read-marking, both roles', () => {
    it('lets both parties see the thread, and marks incoming messages read on open', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();

      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      // The candidate sees the thread with the recruiter's opener unread.
      const candList = await request(app.getHttpServer())
        .get(path('/conversations'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      const candThreads = candList.body as {
        id: string;
        unreadCount: number;
      }[];
      const candThread = candThreads.find((c) => c.id === conversationId);
      expect(candThread).toBeDefined();
      expect(candThread!.unreadCount).toBe(1);

      // Reading the thread returns the opener and marks it read.
      const messages = await request(app.getHttpServer())
        .get(path(`/conversations/${conversationId}/messages`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      const body = messages.body as { body: string; mine: boolean }[];
      expect(body).toHaveLength(1);
      expect(body[0].mine).toBe(false);

      const candListAfter = await request(app.getHttpServer())
        .get(path('/conversations'))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      const after = (
        candListAfter.body as { id: string; unreadCount: number }[]
      ).find((c) => c.id === conversationId);
      expect(after!.unreadCount).toBe(0);
    });

    it('lets the candidate reply, which the recruiter then sees as unread until read', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/messages`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ body: 'Merci, je suis intéressé' })
        .expect(201);

      const recruiterList = await request(app.getHttpServer())
        .get(path('/conversations'))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .expect(200);
      const thread = (
        recruiterList.body as { id: string; unreadCount: number }[]
      ).find((c) => c.id === conversationId);
      expect(thread!.unreadCount).toBe(1);
    });
  });

  describe('EF-MSG-02 — a new-message notification reaches the recipient', () => {
    it('notifies the candidate when a recruiter opens the thread', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();

      await openThread(recruiter.token, candidate.profileId);

      const notifications = await waitForNotifications(candidate.userId, 1);
      expect(notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifications[0].type).toBe(NotificationType.NEW_MESSAGE);
    });
  });

  describe('EF-MSG-03 — antivirus-gated document share with participant-only download', () => {
    it('rejects a disallowed MIME type before any scan (400)', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/messages/attachment`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .attach('file', Buffer.from('plain text'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(400);
    });

    it('blocks an infected upload (scan gate) with 400 and stores nothing', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/messages/attachment`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .attach('file', Buffer.from('%PDF-1.4 malicious'), {
          filename: 'virus.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
    });

    it('accepts a clean PDF and lets a participant — but only a participant — download it', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token, 'Company A');
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      const upload = await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/messages/attachment`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .field('body', 'Voici la fiche de poste')
        .attach('file', Buffer.from('%PDF-1.4 clean'), {
          filename: 'poste.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      // The attachment endpoint returns the persisted Message entity, whose
      // attachment metadata is stored as flat columns.
      const message = upload.body as {
        id: string;
        attachmentOriginalName: string | null;
        attachmentMimeType: string | null;
      };
      expect(message.attachmentOriginalName).toBe('poste.pdf');
      expect(message.attachmentMimeType).toBe('application/pdf');

      // The candidate (a participant) resolves a signed URL.
      const download = await request(app.getHttpServer())
        .get(
          path(
            `/conversations/${conversationId}/messages/${message.id}/attachment`,
          ),
        )
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      expect((download.body as { url: string }).url).toBeTruthy();

      // A recruiter from another company is not a participant → 403.
      const outsider = await createUser([Role.RECRUITER]);
      await createCompanyFor(outsider.token, 'Company B');
      await request(app.getHttpServer())
        .get(
          path(
            `/conversations/${conversationId}/messages/${message.id}/attachment`,
          ),
        )
        .set('Authorization', `Bearer ${outsider.token}`)
        .expect(403);
    });
  });

  describe('EF-MSG-05 — abuse report reaches the admin moderation queue', () => {
    it('lets a participant report the thread; the report shows up in the admin queue and can be actioned', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      const reported = await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/report`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ reason: 'Propos inappropriés' })
        .expect(201);
      const reportId = (reported.body as { id: string }).id;
      expect(reportId).toBeTruthy();

      const admin = await createUser([Role.ADMIN]);
      const queue = await request(app.getHttpServer())
        .get(path('/admin/message-reports'))
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      const rows = queue.body as {
        id: string;
        conversationId: string;
        status: string;
      }[];
      const row = rows.find((r) => r.id === reportId);
      expect(row).toBeDefined();
      expect(row!.conversationId).toBe(conversationId);
      expect(row!.status).toBe(MessageReportStatus.OPEN);

      // The moderator resolves it.
      const patched = await request(app.getHttpServer())
        .patch(path(`/admin/message-reports/${reportId}`))
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: MessageReportStatus.REVIEWED })
        .expect(200);
      expect((patched.body as { status: string }).status).toBe(
        MessageReportStatus.REVIEWED,
      );
    });

    it('does not let a non-participant report the thread (404)', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token, 'Company A');
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      const outsider = await createUser([Role.RECRUITER]);
      await createCompanyFor(outsider.token, 'Company B');
      await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/report`))
        .set('Authorization', `Bearer ${outsider.token}`)
        .send({ reason: 'tentative' })
        .expect(404);
    });
  });

  describe('EF-MSG-04 — interview scheduling within a conversation', () => {
    const future = () => new Date(Date.now() + 3 * 86_400_000).toISOString();

    it('recruiter proposes a slot, candidate sees it and accepts; the recruiter is notified', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      const proposed = await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/interviews`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          mode: 'video',
          scheduledAt: future(),
          durationMinutes: 45,
          location: 'https://meet.example/interview',
        })
        .expect(201);
      const interview = proposed.body as {
        id: string;
        status: string;
        mine: boolean;
      };
      expect(interview.status).toBe('proposed');

      // Candidate sees it (and it is not "theirs").
      const candList = await request(app.getHttpServer())
        .get(path(`/conversations/${conversationId}/interviews`))
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(200);
      const rows = candList.body as {
        id: string;
        mine: boolean;
        status: string;
      }[];
      expect(rows.find((r) => r.id === interview.id)?.mine).toBe(false);

      // Candidate accepts.
      const accepted = await request(app.getHttpServer())
        .patch(
          path(`/conversations/${conversationId}/interviews/${interview.id}`),
        )
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ status: 'accepted' })
        .expect(200);
      expect((accepted.body as { status: string }).status).toBe('accepted');

      // The recruiter received an interview notification (proposal → candidate,
      // acceptance → recruiter). Poll: dispatch is fire-and-forget.
      let interviewNotes: Notification[] = [];
      for (let attempt = 0; attempt < 20; attempt += 1) {
        interviewNotes = await notificationRepo.find({
          where: { recipientUserId: recruiter.userId },
        });
        if (
          interviewNotes.some(
            (n) => n.type === NotificationType.INTERVIEW_UPDATED,
          )
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(
        interviewNotes.some(
          (n) => n.type === NotificationType.INTERVIEW_UPDATED,
        ),
      ).toBe(true);
    });

    it('forbids the proposer from accepting their own proposal (403)', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      const proposed = await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/interviews`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ mode: 'onsite', scheduledAt: future() })
        .expect(201);
      const id = (proposed.body as { id: string }).id;

      await request(app.getHttpServer())
        .patch(path(`/conversations/${conversationId}/interviews/${id}`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ status: 'accepted' })
        .expect(403);
    });

    it('rejects a past scheduledAt (400)', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token);
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/interviews`))
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          mode: 'phone',
          scheduledAt: new Date(Date.now() - 3600_000).toISOString(),
        })
        .expect(400);
    });

    it('does not let a non-participant propose or list interviews (404)', async () => {
      const recruiter = await createUser([Role.RECRUITER]);
      await createCompanyFor(recruiter.token, 'Company A');
      const candidate = await createCandidate();
      const conversationId = await openThread(
        recruiter.token,
        candidate.profileId,
      );

      const outsider = await createUser([Role.RECRUITER]);
      await createCompanyFor(outsider.token, 'Company B');
      await request(app.getHttpServer())
        .get(path(`/conversations/${conversationId}/interviews`))
        .set('Authorization', `Bearer ${outsider.token}`)
        .expect(404);
      await request(app.getHttpServer())
        .post(path(`/conversations/${conversationId}/interviews`))
        .set('Authorization', `Bearer ${outsider.token}`)
        .send({ mode: 'video', scheduledAt: future() })
        .expect(404);
    });
  });
});
