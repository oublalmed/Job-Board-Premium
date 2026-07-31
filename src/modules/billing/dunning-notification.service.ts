import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Recruiter } from '../companies/entities/recruiter.entity.js';
import type { MailProvider } from '../../ports/mail.port.js';
import { MAIL_PROVIDER } from '../../ports/mail.port.js';

interface DunningMail {
  subject: string;
  templateId: string;
}

// Email-only, direct mailProvider.send() calls — same convention as
// AuthService's verification email. No queue: this repo has no
// BullMQ processor built yet, and building one is out of scope for the
// dunning feature itself (Lot 6D).
@Injectable()
export class DunningNotificationService {
  private readonly logger = new Logger(DunningNotificationService.name);

  constructor(
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,
  ) {}

  async notifyPaymentFailed(
    companyId: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.sendToRecruiters(companyId, manager, {
      subject: 'Échec de paiement — Job Board Premium',
      templateId: 'subscription-payment-failed',
    });
  }

  async notifySubscriptionCancelled(
    companyId: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.sendToRecruiters(companyId, manager, {
      subject: 'Abonnement suspendu — Job Board Premium',
      templateId: 'subscription-cancelled',
    });
  }

  async notifySubscriptionReactivated(
    companyId: string,
    manager: EntityManager,
  ): Promise<void> {
    await this.sendToRecruiters(companyId, manager, {
      subject: 'Abonnement réactivé — Job Board Premium',
      templateId: 'subscription-reactivated',
    });
  }

  // Best-effort, on purpose: a mail provider outage must not roll back the
  // subscription status change it's attached to (PAST_DUE/CANCELLED/ACTIVE
  // are real billing state — Stripe already committed to it). One failed
  // notification is logged, not thrown, and never blocks the caller's
  // transaction.
  private async sendToRecruiters(
    companyId: string,
    manager: EntityManager,
    mail: DunningMail,
  ): Promise<void> {
    const recruiters = await manager.getRepository(Recruiter).find({
      where: { companyId },
      relations: { user: true },
    });

    for (const recruiter of recruiters) {
      try {
        await this.mailProvider.send({
          to: recruiter.user.email,
          subject: mail.subject,
          templateId: mail.templateId,
          variables: {},
        });
      } catch (error) {
        this.logger.warn(
          `Dunning notification (${mail.templateId}) failed for ${recruiter.user.email}: ${(error as Error).message}`,
        );
      }
    }
  }
}
