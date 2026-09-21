import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AnalyticsEventType } from '../analytics/entities/analytics-event.entity.js';
import { NotificationService } from '../notifications/notification.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { DataSource, Repository, In, IsNull, Not } from 'typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { Message, MessageSenderRole } from './entities/message.entity.js';
import {
  MessageReport,
  MessageReportStatus,
} from './entities/message-report.entity.js';
import { CandidateProfile } from '../candidates/entities/candidate-profile.entity.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../../common/enums/audit-action.enum.js';
import { SubscriptionGuardService } from '../companies/subscription-guard.service.js';
import { ContactQuotaService } from '../companies/contact-quota.service.js';
import { isUniqueViolation } from '../../common/typeorm/is-unique-violation.js';
import type { FileScanner } from '../../ports/file-scanner.port.js';
import { FILE_SCANNER } from '../../ports/file-scanner.port.js';
import type { ObjectStorage } from '../../ports/object-storage.port.js';
import { OBJECT_STORAGE } from '../../ports/object-storage.port.js';
import {
  CandidateProfileNotFoundException,
  ConversationNotFoundException,
} from './messaging.exceptions.js';

// EF-MSG-03 — same rules as CV upload: PDF/DOCX only, ≤5MB, antivirus-gated.
const ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024;
const ATTACHMENT_ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Defense-in-depth: the client-supplied filename is untrusted and gets
// embedded in the object-storage key. Strip any path components and anything
// outside a safe charset so a crafted name (`../`, control chars, separators)
// can never escape the intended prefix in a filesystem-backed storage adapter,
// and cap the length. A uuid still guarantees key uniqueness.
function safeAttachmentName(originalname: string): string {
  const base = (originalname || 'document').split(/[/\\]/).pop() ?? 'document';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  return (cleaned || 'document').slice(0, 100);
}

export interface AttachmentUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

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

export interface MessageAttachmentView {
  originalName: string;
  mimeType: string;
  size: number;
}

export interface MessageView {
  id: string;
  body: string;
  senderRole: MessageSenderRole;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
  // EF-MSG-03 — metadata only; the binary is fetched via the signed-url
  // endpoint, never by exposing the storage key.
  attachment: MessageAttachmentView | null;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

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
    @InjectRepository(MessageReport)
    private readonly messageReportRepo: Repository<MessageReport>,
    private readonly auditService: AuditService,
    @Inject(FILE_SCANNER)
    private readonly fileScanner: FileScanner,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    // Optional so unit tests need not wire the (global) analytics module.
    @Optional() private readonly analytics?: AnalyticsService,
    // Optional for the same reason — messaging works without it, the in-app
    // notification is a best-effort side effect (EF-MSG-02).
    @Optional() private readonly notifications?: NotificationService,
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
      // EF-MSG-02 — the candidate is the recipient of the recruiter's opener.
      void this.notifyNewMessage(
        candidateProfile.userId,
        MessageSenderRole.RECRUITER,
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

    const message = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        senderId: senderUserId,
        senderRole,
        body,
      }),
    );

    // EF-MSG-02 — notify the counterpart. Recruiter → candidate (user behind
    // the profile); candidate → the recruiter who opened the thread.
    const recipientUserId = await this.resolveRecipient(
      conversation,
      senderRole,
    );
    if (recipientUserId) {
      void this.notifyNewMessage(recipientUserId, senderRole);
    }

    return message;
  }

  // EF-MSG-03 — a participant attaches ONE document to a message (the caption
  // in `body` is optional: a blank body is a standalone attachment message).
  // Authorization reuses the same SQL-scoped participant check as sending, so
  // a non-participant gets the same 404 as a nonexistent thread. Enforces the
  // exact CV-upload rules: PDF/DOCX only, ≤5MB, blocking antivirus scan.
  async sendAttachment(
    conversationId: string,
    senderUserId: string,
    file: AttachmentUpload,
    body?: string,
  ): Promise<Message> {
    const { conversation, senderRole } = await this.findAuthorizedConversation(
      conversationId,
      senderUserId,
    );

    if (!file || !file.size || file.buffer.length === 0) {
      throw new BadRequestException('Le fichier est vide');
    }
    if (file.size > ATTACHMENT_MAX_SIZE) {
      throw new BadRequestException(
        'Le fichier dépasse la taille maximale de 5 Mo',
      );
    }
    if (!ATTACHMENT_ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Type de fichier non autorisé. Types acceptés : PDF, DOCX',
      );
    }

    const scanResult = await this.fileScanner.scan(
      file.buffer,
      file.originalname,
    );
    if (!scanResult.clean) {
      throw new BadRequestException(
        `Fichier rejeté : menace détectée (${scanResult.threat ?? 'threat detected'})`,
      );
    }

    const storageKey = `message-attachments/${conversation.id}/${uuidv4()}-${safeAttachmentName(file.originalname)}`;
    await this.objectStorage.upload({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const message = await this.messageRepo.save(
      this.messageRepo.create({
        conversationId: conversation.id,
        senderId: senderUserId,
        senderRole,
        body: body?.trim() ?? '',
        attachmentStorageKey: storageKey,
        attachmentOriginalName: file.originalname,
        attachmentMimeType: file.mimetype,
        attachmentSize: file.size,
      }),
    );

    const recipientUserId = await this.resolveRecipient(
      conversation,
      senderRole,
    );
    if (recipientUserId) {
      void this.notifyNewMessage(recipientUserId, senderRole);
    }

    return message;
  }

  // EF-MSG-03 — a short-lived signed URL for an attachment, authorized to the
  // two conversation participants ONLY (403 for anyone else). The message must
  // belong to the thread and actually carry an attachment.
  async getAttachmentSignedUrl(
    conversationId: string,
    messageId: string,
    userId: string,
  ): Promise<{ url: string; originalName: string; mimeType: string }> {
    let conversation: Conversation;
    try {
      ({ conversation } = await this.findAuthorizedConversation(
        conversationId,
        userId,
      ));
    } catch {
      // Deliberately 403 (not 404) on the download path per EF-MSG-03: the
      // participant check is SQL-scoped exactly like sending, so this covers
      // both "not your thread" and "no such thread" without leaking which.
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
    }

    const message = await this.messageRepo.findOne({
      where: { id: messageId, conversationId: conversation.id },
    });
    if (!message || !message.attachmentStorageKey) {
      throw new NotFoundException('Attachment not found');
    }

    const url = await this.objectStorage.getSignedUrl(
      message.attachmentStorageKey,
    );
    return {
      url,
      originalName: message.attachmentOriginalName ?? 'document',
      mimeType: message.attachmentMimeType ?? 'application/octet-stream',
    };
  }

  private async resolveRecipient(
    conversation: Conversation,
    senderRole: MessageSenderRole,
  ): Promise<string | null> {
    if (senderRole === MessageSenderRole.CANDIDATE) {
      return conversation.recruiterId;
    }
    const candidateProfile = await this.candidateProfileRepo.findOne({
      where: { id: conversation.candidateId },
    });
    return candidateProfile?.userId ?? null;
  }

  // Best-effort in-app notification: a failure here must never fail sending
  // or opening a thread, so it is fire-and-forget with a logged warning.
  private async notifyNewMessage(
    recipientUserId: string,
    senderRole: MessageSenderRole,
  ): Promise<void> {
    if (!this.notifications) return;
    const fromLabel =
      senderRole === MessageSenderRole.RECRUITER
        ? 'un recruteur'
        : 'un candidat';
    try {
      await this.notifications.create({
        recipientUserId,
        type: NotificationType.NEW_MESSAGE,
        title: 'Nouveau message',
        body: `Vous avez reçu un nouveau message de ${fromLabel}.`,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to create new-message notification for ${recipientUserId}: ${(error as Error).message}`,
      );
    }
  }

  // EF-MSG-05 — a participant flags a conversation for abuse. Authorization
  // reuses the same participant check as sending/reading, so a stranger gets
  // the same 404 as a nonexistent thread. Recorded as a moderation-queue row
  // and in the audit trail.
  async reportConversation(
    conversationId: string,
    reporterUserId: string,
    reason: string,
  ): Promise<{ id: string; status: string }> {
    const { conversation } = await this.findAuthorizedConversation(
      conversationId,
      reporterUserId,
    );

    const report = await this.messageReportRepo.save(
      this.messageReportRepo.create({
        conversationId: conversation.id,
        reporterUserId,
        reason,
      }),
    );

    await this.auditService.log({
      actorId: reporterUserId,
      action: AuditAction.MODERATION_ACTION,
      entityType: 'conversation',
      entityId: conversation.id,
      metadata: { kind: 'message_abuse_report', reportId: report.id },
    });

    return { id: report.id, status: report.status };
  }

  // EF-ADM-01 / EF-MSG-05 (admin side) — the moderation queue. Newest first,
  // optionally filtered by status. Admin-only (enforced at the controller).
  async listReports(status?: MessageReportStatus): Promise<MessageReport[]> {
    return this.messageReportRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async updateReportStatus(
    reportId: string,
    status: MessageReportStatus,
    moderatorUserId: string,
  ): Promise<{ id: string; status: string }> {
    const report = await this.messageReportRepo.findOne({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException('Message report not found');
    }
    report.status = status;
    await this.messageReportRepo.save(report);

    await this.auditService.log({
      actorId: moderatorUserId,
      action: AuditAction.MODERATION_ACTION,
      entityType: 'message_report',
      entityId: report.id,
      metadata: { status },
    });

    return { id: report.id, status: report.status };
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
      attachment:
        m.attachmentStorageKey && m.attachmentOriginalName
          ? {
              originalName: m.attachmentOriginalName,
              mimeType: m.attachmentMimeType ?? 'application/octet-stream',
              size: m.attachmentSize ?? 0,
            }
          : null,
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
