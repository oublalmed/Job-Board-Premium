import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity.js';

export interface CreateNotificationParams {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
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
    return repo.save(repo.create(params));
  }

  async listForUser(recipientUserId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { recipientUserId },
      order: { createdAt: 'DESC' },
    });
  }
}
