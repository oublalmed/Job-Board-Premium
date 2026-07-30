import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { Message, MessageSenderRole } from './entities/message.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { SubscriptionGuardService } from '../companies/subscription-guard.service.js';
import { ContactQuotaService } from '../companies/contact-quota.service.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';
import {
  CandidateProfileNotFoundException,
  ConversationNotFoundException,
} from './messaging.exceptions.js';

@Injectable()
export class ConversationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly subscriptionGuard: SubscriptionGuardService,
    private readonly contactQuotaService: ContactQuotaService,
    @InjectRepository(CandidateProfile)
    private readonly candidateProfileRepo: Repository<CandidateProfile>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async openConversation(
    recruiterUserId: string,
    candidateProfileId: string,
    firstMessageBody: string,
  ): Promise<Conversation> {
    const { companyId } =
      await this.subscriptionGuard.assertActiveSubscription(recruiterUserId);

    const candidateProfile = await this.candidateProfileRepo.findOne({
      where: { id: candidateProfileId },
    });
    if (!candidateProfile) {
      throw new CandidateProfileNotFoundException(candidateProfileId);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        // Same transaction as the inserts below: if either insert fails
        // (including the unique-violation path this method handles just
        // below), the whole transaction — decrement included — rolls back.
        // The quota is never spent without a thread actually being created.
        await this.contactQuotaService.consumeOneContact(companyId, manager);

        const conversation = await manager.getRepository(Conversation).save(
          manager.getRepository(Conversation).create({
            candidateId: candidateProfileId,
            recruiterId: recruiterUserId,
            companyId,
          }),
        );

        await manager.getRepository(Message).save(
          manager.getRepository(Message).create({
            conversationId: conversation.id,
            senderId: recruiterUserId,
            senderRole: MessageSenderRole.RECRUITER,
            body: firstMessageBody,
          }),
        );

        return conversation;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      // Idempotence comes from the UNIQUE (candidate_id, company_id)
      // constraint, not from a findOne-then-insert check: the transaction
      // above already rolled back (quota decrement included) by the time
      // we get here, so re-reading and returning the existing thread never
      // double-spends the quota, no matter how many callers race this
      // exact call concurrently.
      const existing = await this.conversationRepo.findOne({
        where: { candidateId: candidateProfileId, companyId },
      });
      if (existing) {
        return existing;
      }
      throw error;
    }
  }

  async sendMessage(
    conversationId: string,
    senderUserId: string,
    body: string,
  ): Promise<Message> {
    const { conversation, senderRole } = await this.findAuthorizedConversation(
      conversationId,
      senderUserId,
    );

    return this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        senderId: senderUserId,
        senderRole,
        body,
      }),
    );
  }

  // Resolves who the caller is (recruiter of some company, and/or the
  // candidate behind some profile) and scopes each lookup's WHERE to that
  // resolved id directly, rather than fetching the conversation by id alone
  // and checking company/candidate membership in application code — same
  // "filter in SQL, not after the fact" rule as the rest of this module
  // (ADR-0001).
  private async findAuthorizedConversation(
    conversationId: string,
    senderUserId: string,
  ): Promise<{ conversation: Conversation; senderRole: MessageSenderRole }> {
    const recruiterCompanyId = await this.subscriptionGuard
      .resolveCompanyId(senderUserId)
      .catch(() => null);

    if (recruiterCompanyId) {
      const conversation = await this.conversationRepo.findOne({
        where: { id: conversationId, companyId: recruiterCompanyId },
      });
      if (conversation) {
        return { conversation, senderRole: MessageSenderRole.RECRUITER };
      }
    }

    const candidateProfile = await this.candidateProfileRepo.findOne({
      where: { userId: senderUserId },
    });
    if (candidateProfile) {
      const conversation = await this.conversationRepo.findOne({
        where: { id: conversationId, candidateId: candidateProfile.id },
      });
      if (conversation) {
        return { conversation, senderRole: MessageSenderRole.CANDIDATE };
      }
    }

    throw new ConversationNotFoundException(conversationId);
  }
}
