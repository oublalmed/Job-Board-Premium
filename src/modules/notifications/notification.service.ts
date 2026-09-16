import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity.js';
import { User } from '../users/entities/user.entity.js';
import type { Mailer } from '../../ports/mailer.port.js';
import { MAILER } from '../../ports/mailer.port.js';

export interface CreateNotificationParams {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    // Optional so unit tests that only exercise the in-app path need not wire
    // the (global) mailer. EF-MSG-02 email dispatch is a best-effort side
    // effect gated behind `notifications.emailEnabled` (default false).
    @Optional() @Inject(MAILER) private readonly mailer?: Mailer,
  ) {}

  // Accepts an optional transactional manager so callers that need the
  // in-app row to land atomically with something else (e.g. the cooldown
  // claim in Lot 7 commit 2) can pass one in; defaults to the injected
  // repository otherwise.
  async create(
    params: CreateNotificationParams,
    manager?: EntityManager,
  ): Promise<Notification> {
    const repo = manager
      ? manager.getRepository(Notification)
      : this.notificationRepo;
    const saved = await repo.save(repo.create(params));

    // EF-MSG-02 — the email half of "in-app + email". Strictly best-effort:
    // it never runs unless the flag is on, and any failure is swallowed so
    // the in-app notification (already persisted above) is never impacted.
    await this.dispatchEmail(params);

    return saved;
  }

  async listForUser(recipientUserId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { recipientUserId },
      order: { createdAt: 'DESC' },
    });
  }

  // Best-effort email dispatch. Returns (never throws) so the in-app path is
  // never broken. No-op when the channel is disabled (the default) — in that
  // case it does not even resolve the recipient's email.
  private async dispatchEmail(params: CreateNotificationParams): Promise<void> {
    const enabled = this.config.get<boolean>('notifications.emailEnabled');
    if (!enabled || !this.mailer) return;

    try {
      const user = await this.userRepo.findOne({
        where: { id: params.recipientUserId },
      });
      if (!user?.email) return;

      await this.mailer.sendMail({
        to: user.email,
        subject: params.title,
        body: params.body,
      });
    } catch (error) {
      this.logger.warn(
        `Email dispatch failed for ${params.recipientUserId}: ${(error as Error).message}`,
      );
    }
  }
}
