import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { MailProvider } from '../../ports/mail.port.js';
import { MAIL_PROVIDER } from '../../ports/mail.port.js';
import { NotificationService } from './notification.service.js';
import { NotificationType } from './entities/notification.entity.js';

interface NotificationRecipient {
  recipientUserId: string;
  email: string;
}

// The "in-app + email" half of EF-REM-03 / EF-GROW-04 — reuses
// NotificationService for the in-app row and calls MailProvider directly
// for email, same convention as DunningNotificationService (Lot 6D): no
// BullMQ-backed mail queue, no shared abstract base class for what's still
// only two call sites.
@Injectable()
export class GrowthNotificationService {
  private readonly logger = new Logger(GrowthNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: MailProvider,
  ) {}

  async notifyCooldownExpired(
    recipient: NotificationRecipient,
    manager?: EntityManager,
  ): Promise<void> {
    await this.notify(
      recipient,
      {
        type: NotificationType.COOLDOWN_EXPIRED,
        title: 'Vous pouvez repasser votre test',
        body: 'Le délai de 90 jours est écoulé — vous pouvez retenter ce test dès maintenant.',
        templateId: 'cooldown-expired',
      },
      manager,
    );
  }

  private async notify(
    recipient: NotificationRecipient,
    mail: {
      type: NotificationType;
      title: string;
      body: string;
      templateId: string;
    },
    manager?: EntityManager,
  ): Promise<void> {
    // In-app: a real DB write on the same database as everything else —
    // expected to succeed, not best-effort.
    await this.notificationService.create(
      {
        recipientUserId: recipient.recipientUserId,
        type: mail.type,
        title: mail.title,
        body: mail.body,
      },
      manager,
    );

    // Email: best-effort, deliberately — same reasoning as
    // DunningNotificationService. A mail provider outage must not undo the
    // in-app notification already written, nor the atomic claim it rides
    // on (e.g. the cooldown-notified marker).
    try {
      await this.mailProvider.send({
        to: recipient.email,
        subject: mail.title,
        templateId: mail.templateId,
        variables: {},
      });
    } catch (error) {
      this.logger.warn(
        `Growth notification email (${mail.templateId}) failed for ${recipient.email}: ${(error as Error).message}`,
      );
    }
  }
}
