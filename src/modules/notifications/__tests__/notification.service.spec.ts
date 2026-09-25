import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { NotificationService } from '../notification.service.js';
import {
  Notification,
  NotificationType,
} from '../entities/notification.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { MAILER } from '../../../ports/mailer.port.js';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;
  let mailer: { sendMail: jest.Mock };
  let emailEnabled: boolean;

  beforeEach(async () => {
    emailEnabled = false;
    notificationRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => e),
      save: jest.fn().mockImplementation((e: Record<string, unknown>) =>
        Promise.resolve({
          id: 'notif-1',
          createdAt: new Date(),
          readAt: null,
          ...e,
        }),
      ),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'user-1', email: 'recipient@example.com' }),
    };
    mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'notifications.emailEnabled' ? emailEnabled : undefined,
            ),
          },
        },
        { provide: MAILER, useValue: mailer },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  it('creates a notification via the injected repository by default', async () => {
    const result = await service.create({
      recipientUserId: 'user-1',
      type: NotificationType.COOLDOWN_EXPIRED,
      title: 'Title',
      body: 'Body',
    });

    expect(notificationRepo.create).toHaveBeenCalledWith({
      recipientUserId: 'user-1',
      type: NotificationType.COOLDOWN_EXPIRED,
      title: 'Title',
      body: 'Body',
    });
    expect(result.id).toBe('notif-1');
  });

  it('creates via a passed-in EntityManager when provided, not the injected repo', async () => {
    const scopedRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => e),
      save: jest.fn().mockResolvedValue({ id: 'notif-2' }),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(scopedRepo),
    } as unknown as EntityManager;

    await service.create(
      {
        recipientUserId: 'user-1',
        type: NotificationType.PROFILE_VIEWED,
        title: 'Title',
        body: 'Body',
      },
      manager,
    );

    expect(manager.getRepository).toHaveBeenCalledWith(Notification);
    expect(scopedRepo.save).toHaveBeenCalled();
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('lists notifications for a user, scoped by recipientUserId, newest first', async () => {
    await service.listForUser('user-1');

    expect(notificationRepo.find).toHaveBeenCalledWith({
      where: { recipientUserId: 'user-1' },
      order: { createdAt: 'DESC' },
    });
  });

  describe('email channel (EF-MSG-02)', () => {
    it('does not dispatch an email — nor even resolve the recipient — when disabled (default)', async () => {
      emailEnabled = false;

      await service.create({
        recipientUserId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'Nouveau message',
        body: 'Vous avez un message.',
      });

      expect(mailer.sendMail).not.toHaveBeenCalled();
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('dispatches an email to the recipient when the channel is enabled', async () => {
      emailEnabled = true;

      await service.create({
        recipientUserId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'Nouveau message',
        body: 'Vous avez un message.',
      });

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(mailer.sendMail).toHaveBeenCalledWith({
        to: 'recipient@example.com',
        subject: 'Nouveau message',
        body: 'Vous avez un message.',
      });
    });

    it('swallows a mailer failure and still persists the in-app notification', async () => {
      emailEnabled = true;
      mailer.sendMail.mockRejectedValue(new Error('smtp down'));

      const result = await service.create({
        recipientUserId: 'user-1',
        type: NotificationType.NEW_MESSAGE,
        title: 'Nouveau message',
        body: 'Vous avez un message.',
      });

      expect(result.id).toBe('notif-1');
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('no-ops the email when the recipient has no resolvable address', async () => {
      emailEnabled = true;
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          recipientUserId: 'ghost',
          type: NotificationType.NEW_MESSAGE,
          title: 'Nouveau message',
          body: 'Vous avez un message.',
        }),
      ).resolves.toEqual(expect.objectContaining({ id: 'notif-1' }));
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('mark as read', () => {
    it('marks a single notification read scoped to the owner and unread rows', async () => {
      await service.markRead('user-1', 'notif-9');

      const [where, patch] = notificationRepo.update.mock.calls[0];
      expect(where.recipientUserId).toBe('user-1');
      expect(where.id).toBe('notif-9');
      // Only touches still-unread rows (readAt IS NULL) and stamps a date.
      expect(where.readAt).toBeDefined();
      expect(patch.readAt).toBeInstanceOf(Date);
    });

    it('marks all unread notifications read and returns the count', async () => {
      notificationRepo.update.mockResolvedValueOnce({ affected: 3 });

      const result = await service.markAllRead('user-1');

      expect(result).toEqual({ updated: 3 });
      const [where] = notificationRepo.update.mock.calls[0];
      expect(where.recipientUserId).toBe('user-1');
      expect(where.readAt).toBeDefined();
    });
  });
});
