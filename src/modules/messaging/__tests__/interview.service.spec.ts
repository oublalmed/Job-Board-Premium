import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InterviewService } from '../interview.service.js';
import {
  Interview,
  InterviewMode,
  InterviewStatus,
} from '../entities/interview.entity.js';
import { MessageSenderRole } from '../entities/message.entity.js';
import { ConversationService } from '../conversation.service.js';
import { NotificationService } from '../../notifications/notification.service.js';
import { NotificationType } from '../../notifications/entities/notification.entity.js';

describe('InterviewService (EF-MSG-04)', () => {
  let service: InterviewService;
  let interviewRepo: Record<string, jest.Mock>;
  let conversations: Record<string, jest.Mock>;
  let notifications: Record<string, jest.Mock>;

  const conversation = { id: 'conv-1' } as never;
  const recruiterId = 'recruiter-user-1';
  const candidateId = 'candidate-user-1';
  const future = new Date(Date.now() + 86_400_000).toISOString();

  function makeInterview(over: Partial<Interview> = {}): Interview {
    return {
      id: 'iv-1',
      conversationId: 'conv-1',
      proposedById: recruiterId,
      proposedByRole: MessageSenderRole.RECRUITER,
      status: InterviewStatus.PROPOSED,
      mode: InterviewMode.VIDEO,
      scheduledAt: new Date(future),
      durationMinutes: 60,
      location: null,
      note: null,
      respondedAt: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      ...over,
    } as Interview;
  }

  beforeEach(async () => {
    interviewRepo = {
      create: jest.fn((v: Partial<Interview>) => v),
      save: jest.fn((v: Partial<Interview>) =>
        Promise.resolve(makeInterview(v)),
      ),
      find: jest.fn().mockResolvedValue([makeInterview()]),
      findOne: jest.fn().mockResolvedValue(makeInterview()),
    };
    conversations = {
      authorizeParticipant: jest.fn().mockResolvedValue({
        conversation,
        senderRole: MessageSenderRole.RECRUITER,
      }),
      counterpartUserId: jest.fn().mockResolvedValue(candidateId),
    };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: getRepositoryToken(Interview), useValue: interviewRepo },
        { provide: ConversationService, useValue: conversations },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    service = module.get(InterviewService);
  });

  describe('propose', () => {
    it('creates a PROPOSED interview, notifies the counterpart, and marks it mine', async () => {
      const view = await service.propose(conversation.id, recruiterId, {
        mode: InterviewMode.VIDEO,
        scheduledAt: future,
        durationMinutes: 45,
        location: 'https://meet.example/abc',
      });

      expect(conversations.authorizeParticipant).toHaveBeenCalledWith(
        'conv-1',
        recruiterId,
      );
      const saved = interviewRepo.save.mock.calls[0][0] as Partial<Interview>;
      expect(saved.status).toBe(InterviewStatus.PROPOSED);
      expect(saved.proposedByRole).toBe(MessageSenderRole.RECRUITER);
      expect(saved.durationMinutes).toBe(45);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: candidateId,
          type: NotificationType.INTERVIEW_PROPOSED,
        }),
      );
      expect(view.mine).toBe(true);
      expect(view.status).toBe(InterviewStatus.PROPOSED);
    });

    it('rejects a scheduledAt in the past', async () => {
      await expect(
        service.propose(conversation.id, recruiterId, {
          mode: InterviewMode.PHONE,
          scheduledAt: new Date(Date.now() - 3600_000).toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(interviewRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an unparseable scheduledAt', async () => {
      await expect(
        service.propose(conversation.id, recruiterId, {
          mode: InterviewMode.PHONE,
          scheduledAt: 'not-a-date',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('respond', () => {
    it('lets the counterpart accept a proposed interview', async () => {
      // The candidate is the counterpart of a recruiter-proposed interview.
      conversations.authorizeParticipant.mockResolvedValue({
        conversation,
        senderRole: MessageSenderRole.CANDIDATE,
      });
      conversations.counterpartUserId.mockResolvedValue(recruiterId);

      const view = await service.respond(
        conversation.id,
        'iv-1',
        candidateId,
        InterviewStatus.ACCEPTED,
      );

      expect(view.status).toBe(InterviewStatus.ACCEPTED);
      const saved = interviewRepo.save.mock.calls[0][0] as Interview;
      expect(saved.respondedAt).toBeInstanceOf(Date);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.INTERVIEW_UPDATED }),
      );
    });

    it('forbids the proposer from accepting their own proposal', async () => {
      // Proposer is the recruiter; recruiter tries to ACCEPT.
      conversations.authorizeParticipant.mockResolvedValue({
        conversation,
        senderRole: MessageSenderRole.RECRUITER,
      });
      await expect(
        service.respond(
          conversation.id,
          'iv-1',
          recruiterId,
          InterviewStatus.ACCEPTED,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('forbids the counterpart from cancelling (only the proposer cancels)', async () => {
      conversations.authorizeParticipant.mockResolvedValue({
        conversation,
        senderRole: MessageSenderRole.CANDIDATE,
      });
      await expect(
        service.respond(
          conversation.id,
          'iv-1',
          candidateId,
          InterviewStatus.CANCELLED,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the proposer cancel their own proposal', async () => {
      conversations.authorizeParticipant.mockResolvedValue({
        conversation,
        senderRole: MessageSenderRole.RECRUITER,
      });
      const view = await service.respond(
        conversation.id,
        'iv-1',
        recruiterId,
        InterviewStatus.CANCELLED,
      );
      expect(view.status).toBe(InterviewStatus.CANCELLED);
    });

    it('rejects responding to an already-answered interview', async () => {
      interviewRepo.findOne.mockResolvedValue(
        makeInterview({ status: InterviewStatus.ACCEPTED }),
      );
      conversations.authorizeParticipant.mockResolvedValue({
        conversation,
        senderRole: MessageSenderRole.CANDIDATE,
      });
      await expect(
        service.respond(
          conversation.id,
          'iv-1',
          candidateId,
          InterviewStatus.DECLINED,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s when the interview is not in this conversation', async () => {
      interviewRepo.findOne.mockResolvedValue(null);
      await expect(
        service.respond(
          conversation.id,
          'missing',
          candidateId,
          InterviewStatus.ACCEPTED,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('returns the thread interviews as views', async () => {
      const views = await service.list(conversation.id, recruiterId);
      expect(conversations.authorizeParticipant).toHaveBeenCalled();
      expect(views).toHaveLength(1);
      expect(views[0].id).toBe('iv-1');
    });
  });
});
