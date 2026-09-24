import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationService } from './conversation.service.js';
import {
  Interview,
  InterviewMode,
  InterviewStatus,
} from './entities/interview.entity.js';
import { MessageSenderRole } from './entities/message.entity.js';
import { NotificationService } from '../notifications/notification.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';

// EF-MSG-04 — a serialized interview, safe to return over the wire. `mine`
// tells the current viewer whether they proposed it (so the UI can offer the
// proposer "cancel" and the counterpart "accept/decline").
export interface InterviewView {
  id: string;
  status: InterviewStatus;
  mode: InterviewMode;
  scheduledAt: string;
  durationMinutes: number;
  location: string | null;
  note: string | null;
  proposedByRole: MessageSenderRole;
  mine: boolean;
  respondedAt: string | null;
  createdAt: string;
}

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    @InjectRepository(Interview)
    private readonly interviewRepo: Repository<Interview>,
    private readonly conversations: ConversationService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  // EF-MSG-04 — propose a slot. Any participant may propose; authorization is
  // the same SQL-scoped participant check as sending a message.
  async propose(
    conversationId: string,
    userId: string,
    input: {
      mode: InterviewMode;
      scheduledAt: string;
      durationMinutes?: number;
      location?: string;
      note?: string;
    },
  ): Promise<InterviewView> {
    const { conversation, senderRole } =
      await this.conversations.authorizeParticipant(conversationId, userId);

    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt invalide');
    }
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'La date de l’entretien doit être dans le futur',
      );
    }

    const interview = await this.interviewRepo.save(
      this.interviewRepo.create({
        conversationId: conversation.id,
        proposedById: userId,
        proposedByRole: senderRole,
        status: InterviewStatus.PROPOSED,
        mode: input.mode,
        scheduledAt,
        durationMinutes: input.durationMinutes ?? 60,
        location: input.location?.trim() || null,
        note: input.note?.trim() || null,
        respondedAt: null,
      }),
    );

    await this.notifyCounterpart(
      conversation,
      senderRole,
      NotificationType.INTERVIEW_PROPOSED,
      'Proposition d’entretien',
      'Un créneau d’entretien vous a été proposé.',
    );

    return this.toView(interview, userId);
  }

  // EF-MSG-04 — the thread's interviews, newest first.
  async list(conversationId: string, userId: string): Promise<InterviewView[]> {
    const { conversation } = await this.conversations.authorizeParticipant(
      conversationId,
      userId,
    );
    const rows = await this.interviewRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toView(r, userId));
  }

  // EF-MSG-04 — respond to a PROPOSED interview. The counterpart (the party
  // who did NOT propose) may accept or decline; the proposer may cancel. Any
  // other transition is a 400; a terminal interview cannot change again.
  async respond(
    conversationId: string,
    interviewId: string,
    userId: string,
    status:
      | InterviewStatus.ACCEPTED
      | InterviewStatus.DECLINED
      | InterviewStatus.CANCELLED,
  ): Promise<InterviewView> {
    const { conversation, senderRole } =
      await this.conversations.authorizeParticipant(conversationId, userId);

    const interview = await this.interviewRepo.findOne({
      where: { id: interviewId, conversationId: conversation.id },
    });
    if (!interview) {
      throw new NotFoundException('Interview not found');
    }
    if (interview.status !== InterviewStatus.PROPOSED) {
      throw new BadRequestException(
        'Cet entretien a déjà été traité et ne peut plus changer',
      );
    }

    const isProposer = interview.proposedByRole === senderRole;
    if (status === InterviewStatus.CANCELLED) {
      if (!isProposer) {
        throw new ForbiddenException(
          'Seul l’auteur de la proposition peut l’annuler',
        );
      }
    } else if (isProposer) {
      // ACCEPTED / DECLINED are the counterpart's decision only.
      throw new ForbiddenException(
        'Seul le destinataire peut accepter ou refuser la proposition',
      );
    }

    interview.status = status;
    interview.respondedAt = new Date();
    const saved = await this.interviewRepo.save(interview);

    await this.notifyCounterpart(
      conversation,
      senderRole,
      NotificationType.INTERVIEW_UPDATED,
      'Entretien mis à jour',
      `La proposition d’entretien a été ${this.frStatus(status)}.`,
    );

    return this.toView(saved, userId);
  }

  private frStatus(status: InterviewStatus): string {
    switch (status) {
      case InterviewStatus.ACCEPTED:
        return 'acceptée';
      case InterviewStatus.DECLINED:
        return 'refusée';
      case InterviewStatus.CANCELLED:
        return 'annulée';
      default:
        return 'mise à jour';
    }
  }

  // Best-effort, fire-and-forget: a notification failure must never fail the
  // interview action itself (mirrors ConversationService.notifyNewMessage).
  private async notifyCounterpart(
    conversation: Parameters<ConversationService['counterpartUserId']>[0],
    actorRole: MessageSenderRole,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.notifications) return;
    try {
      const recipientUserId = await this.conversations.counterpartUserId(
        conversation,
        actorRole,
      );
      if (!recipientUserId) return;
      await this.notifications.create({ recipientUserId, type, title, body });
    } catch (error) {
      this.logger.warn(
        `Failed to create interview notification: ${(error as Error).message}`,
      );
    }
  }

  private toView(interview: Interview, viewerUserId: string): InterviewView {
    return {
      id: interview.id,
      status: interview.status,
      mode: interview.mode,
      scheduledAt: interview.scheduledAt.toISOString(),
      durationMinutes: interview.durationMinutes,
      location: interview.location,
      note: interview.note,
      proposedByRole: interview.proposedByRole,
      mine: interview.proposedById === viewerUserId,
      respondedAt: interview.respondedAt
        ? interview.respondedAt.toISOString()
        : null,
      createdAt: interview.createdAt.toISOString(),
    };
  }
}
