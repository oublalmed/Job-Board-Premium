import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AnalyticsEventType } from '../analytics/entities/analytics-event.entity.js';
import { DataSource, Repository, In, IsNull, Not } from 'typeorm';
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

export interface ConversationSummary {
  id: string;
  status: string;
  companyId: string;
  companyName: string | null;
  companyLogo: string | null;
  candidateProfileId: string;
  candidateName: string | null;
  // The label of the party the current viewer is talking to.
  counterpartName: string | null;
  lastMessage: {
    body: string;
    senderRole: MessageSenderRole;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageView {
  id: string;
  body: string;
  senderRole: MessageSenderRole;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
}

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
    // Optional so unit tests need not wire the (global) analytics module.
    @Optional() private readonly analytics?: AnalyticsService,
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
      const created = await this.dataSource.transaction(async (manager) => {
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

      // EF-ADM-05 funnel — only a newly created thread counts as a contact.
      void this.analytics?.track(
        AnalyticsEventType.RECRUITER_CONTACT,
        recruiterUserId,
        { candidateProfileId },
      );
      return created;
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

  // Lists every thread the caller can see — as the recruiter of their
  // company and/or as the candidate behind their profile — newest activity
  // first, with the counterpart's name, the last message and an unread count.
  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const companyId = await this.subscriptionGuard
      .resolveCompanyId(userId)
      .catch(() => null);
    const candidateProfile = await this.candidateProfileRepo.findOne({
      where: { userId },
    });

    const where: ({ companyId: string } | { candidateId: string })[] = [];
    if (companyId) where.push({ companyId });
    if (candidateProfile) where.push({ candidateId: candidateProfile.id });
    if (where.length === 0) return [];

    const conversations = await this.conversationRepo.find({
      where,
      relations: { company: true, candidate: true },
      order: { updatedAt: 'DESC' },
    });
    if (conversations.length === 0) return [];

    const ids = conversations.map((c) => c.id);
    const messages = await this.messageRepo.find({
      where: { conversationId: In(ids) },
      order: { createdAt: 'ASC' },
    });

    const lastByConversation = new Map<string, Message>();
    const unreadByConversation = new Map<string, number>();
    for (const m of messages) {
      lastByConversation.set(m.conversationId, m);
      if (m.senderId !== userId && m.readAt === null) {
        unreadByConversation.set(
          m.conversationId,
          (unreadByConversation.get(m.conversationId) ?? 0) + 1,
        );
      }
    }

    const viewerIsRecruiter = !!companyId;
    return conversations.map((c) => {
      const candidateName = c.candidate
        ? [c.candidate.firstName, c.candidate.lastName]
            .filter(Boolean)
            .join(' ') || null
        : null;
      const companyName = c.company?.name ?? null;
      const last = lastByConversation.get(c.id) ?? null;
      return {
        id: c.id,
        status: c.status,
        companyId: c.companyId,
        companyName,
        companyLogo: c.company?.logo ?? null,
        candidateProfileId: c.candidateId,
        candidateName,
        // Recruiter sees the candidate; candidate sees the company.
        counterpartName: viewerIsRecruiter ? candidateName : companyName,
        lastMessage: last
          ? {
              body: last.body,
              senderRole: last.senderRole,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unreadCount: unreadByConversation.get(c.id) ?? 0,
        updatedAt: c.updatedAt.toISOString(),
      };
    });
  }

  // Returns an authorized thread's messages oldest-first, and marks the
  // caller's incoming (not-yet-read) messages as read in the same call —
  // opening a thread is what "reading" means in this UI.
  async listMessages(
    conversationId: string,
    userId: string,
  ): Promise<MessageView[]> {
    const { conversation } = await this.findAuthorizedConversation(
      conversationId,
      userId,
    );

    await this.messageRepo.update(
      {
        conversationId: conversation.id,
        senderId: Not(userId),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );

    const messages = await this.messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'ASC' },
    });

    return messages.map((m) => ({
      id: m.id,
      body: m.body,
      senderRole: m.senderRole,
      mine: m.senderId === userId,
      readAt: m.readAt ? m.readAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
    }));
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
