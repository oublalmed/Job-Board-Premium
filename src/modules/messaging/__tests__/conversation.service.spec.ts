import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { ConversationService } from '../conversation.service.js';
import { Conversation } from '../entities/conversation.entity.js';
import { Message, MessageSenderRole } from '../entities/message.entity.js';
import { CandidateProfile } from '../../candidates/entities/candidate-profile.entity.js';
import { SubscriptionGuardService } from '../../companies/subscription-guard.service.js';
import { ContactQuotaService } from '../../companies/contact-quota.service.js';
import { ContactQuotaExceededException } from '../../companies/contact-quota.exceptions.js';
import {
  CandidateProfileNotFoundException,
  ConversationNotFoundException,
} from '../messaging.exceptions.js';

function uniqueViolation(): QueryFailedError {
  const driverError = Object.assign(
    new Error(
      'duplicate key value violates unique constraint "UQ_0db3c001a4353842253d4452ada"',
    ),
    { code: '23505' },
  );
  return new QueryFailedError('INSERT INTO "conversations" ...', [], driverError);
}

describe('ConversationService', () => {
  let service: ConversationService;
  let dataSource: { transaction: jest.Mock };
  let subscriptionGuard: { assertActiveSubscription: jest.Mock; resolveCompanyId: jest.Mock };
  let contactQuotaService: { consumeOneContact: jest.Mock };
  let candidateProfileRepo: { findOne: jest.Mock };
  let conversationRepo: { findOne: jest.Mock };
  let messageRepo: { create: jest.Mock; save: jest.Mock };

  let managerConversationRepo: { create: jest.Mock; save: jest.Mock };
  let managerMessageRepo: { create: jest.Mock; save: jest.Mock };
  let manager: { getRepository: jest.Mock };

  const recruiterUserId = 'recruiter-user-1';
  const candidateProfileId = 'candidate-profile-1';
  const companyId = 'company-1';

  beforeEach(async () => {
    managerConversationRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) =>
        Promise.resolve({ id: 'conversation-1', ...(data as object) }),
      ),
    };
    managerMessageRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) =>
        Promise.resolve({ id: 'message-1', ...(data as object) }),
      ),
    };
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Conversation) return managerConversationRepo;
        if (entity === Message) return managerMessageRepo;
        throw new Error('Unexpected entity requested from manager');
      }),
    };

    dataSource = {
      transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    subscriptionGuard = {
      assertActiveSubscription: jest.fn().mockResolvedValue({ companyId }),
      resolveCompanyId: jest.fn().mockResolvedValue(companyId),
    };
    contactQuotaService = {
      consumeOneContact: jest.fn().mockResolvedValue(undefined),
    };
    candidateProfileRepo = {
      findOne: jest.fn().mockResolvedValue({ id: candidateProfileId }),
    };
    conversationRepo = {
      findOne: jest.fn(),
    };
    messageRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((data: unknown) =>
        Promise.resolve({ id: 'message-1', ...(data as object) }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: DataSource, useValue: dataSource },
        { provide: SubscriptionGuardService, useValue: subscriptionGuard },
        { provide: ContactQuotaService, useValue: contactQuotaService },
        {
          provide: getRepositoryToken(CandidateProfile),
          useValue: candidateProfileRepo,
        },
        { provide: getRepositoryToken(Conversation), useValue: conversationRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
      ],
    }).compile();

    service = module.get(ConversationService);
  });

  describe('openConversation — ouverture nominale', () => {
    it('resolves companyId server-side, consumes one contact, and creates the conversation + first message inside the same transaction', async () => {
      const result = await service.openConversation(
        recruiterUserId,
        candidateProfileId,
        'Bonjour, votre profil nous intéresse',
      );

      expect(subscriptionGuard.assertActiveSubscription).toHaveBeenCalledWith(
        recruiterUserId,
      );
      expect(contactQuotaService.consumeOneContact).toHaveBeenCalledWith(
        companyId,
        manager,
      );
      expect(managerConversationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: candidateProfileId,
          recruiterId: recruiterUserId,
          companyId,
        }),
      );
      expect(managerMessageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          senderId: recruiterUserId,
          senderRole: MessageSenderRole.RECRUITER,
          body: 'Bonjour, votre profil nous intéresse',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({ id: 'conversation-1' }),
      );
    });

    it('throws CandidateProfileNotFoundException and never opens a transaction when the profile does not exist', async () => {
      candidateProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.openConversation(recruiterUserId, candidateProfileId, 'hi'),
      ).rejects.toThrow(CandidateProfileNotFoundException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('openConversation — atomicité (échec après le décrément)', () => {
    it('propagates the failure and performs no compensating action when the Message insert fails', async () => {
      managerMessageRepo.save.mockRejectedValue(
        new Error('simulated failure inserting the first message'),
      );

      await expect(
        service.openConversation(recruiterUserId, candidateProfileId, 'hi'),
      ).rejects.toThrow('simulated failure inserting the first message');

      // consumeOneContact was invoked once, inside the transaction that
      // failed — the service issues no separate "undo" call. Recovery is
      // entirely delegated to dataSource.transaction()'s real rollback
      // (proven against actual Postgres by the e2e concurrency test, which
      // re-reads contacts_used after a forced failure).
      expect(contactQuotaService.consumeOneContact).toHaveBeenCalledTimes(1);
      expect(conversationRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('openConversation — idempotence structurelle (violation de contrainte unique)', () => {
    it('returns the existing thread without consuming a second contact when the transaction fails on the UNIQUE (candidate_id, company_id) constraint', async () => {
      dataSource.transaction.mockRejectedValueOnce(uniqueViolation());
      const existingConversation = {
        id: 'existing-conversation',
        candidateId: candidateProfileId,
        companyId,
      };
      conversationRepo.findOne.mockResolvedValue(existingConversation);

      const result = await service.openConversation(
        recruiterUserId,
        candidateProfileId,
        'hi',
      );

      expect(result).toBe(existingConversation);
      expect(conversationRepo.findOne).toHaveBeenCalledWith({
        where: { candidateId: candidateProfileId, companyId },
      });
    });

    it('rethrows a unique-violation if, surprisingly, no existing thread is found', async () => {
      const violation = uniqueViolation();
      dataSource.transaction.mockRejectedValueOnce(violation);
      conversationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.openConversation(recruiterUserId, candidateProfileId, 'hi'),
      ).rejects.toThrow(violation);
    });
  });

  describe('openConversation — quota épuisé', () => {
    it('propagates ContactQuotaExceededException and creates no conversation', async () => {
      contactQuotaService.consumeOneContact.mockRejectedValue(
        new ContactQuotaExceededException(companyId),
      );

      await expect(
        service.openConversation(recruiterUserId, candidateProfileId, 'hi'),
      ).rejects.toThrow(ContactQuotaExceededException);

      expect(managerConversationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('lets a recruiter of the conversation’s own company send a message, scoping the lookup to companyId in the WHERE', async () => {
      const conversation = { id: 'conversation-1', companyId, candidateId: candidateProfileId };
      conversationRepo.findOne.mockResolvedValue(conversation);

      await service.sendMessage('conversation-1', recruiterUserId, 'reply');

      expect(conversationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'conversation-1', companyId },
      });
      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          senderRole: MessageSenderRole.RECRUITER,
          body: 'reply',
        }),
      );
    });

    it('lets the candidate on the thread send a message, scoping the lookup to candidateId in the WHERE', async () => {
      subscriptionGuard.resolveCompanyId.mockRejectedValue(
        new Error('not a recruiter'),
      );
      candidateProfileRepo.findOne.mockResolvedValue({ id: candidateProfileId });
      const conversation = { id: 'conversation-1', companyId, candidateId: candidateProfileId };
      conversationRepo.findOne.mockResolvedValue(conversation);

      await service.sendMessage('conversation-1', 'candidate-user-1', 'reply');

      expect(conversationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'conversation-1', candidateId: candidateProfileId },
      });
      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ senderRole: MessageSenderRole.CANDIDATE }),
      );
    });

    it('never consumes quota when sending a message to an existing thread', async () => {
      conversationRepo.findOne.mockResolvedValue({
        id: 'conversation-1',
        companyId,
        candidateId: candidateProfileId,
      });

      await service.sendMessage('conversation-1', recruiterUserId, 'reply');

      expect(contactQuotaService.consumeOneContact).not.toHaveBeenCalled();
    });

    it('throws ConversationNotFoundException (404) for a recruiter from a different company — isolation', async () => {
      subscriptionGuard.resolveCompanyId.mockResolvedValue('other-company');
      // WHERE id + companyId('other-company') never matches a thread that
      // belongs to `companyId` — simulated here by the mock simply
      // returning null, exactly as Postgres would for a non-matching WHERE.
      conversationRepo.findOne.mockResolvedValue(null);
      candidateProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sendMessage('conversation-1', 'other-recruiter', 'x'),
      ).rejects.toThrow(ConversationNotFoundException);
    });
  });
});
