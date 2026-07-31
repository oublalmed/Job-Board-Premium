import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { NotificationService } from '../notification.service.js';
import { Notification, NotificationType } from '../entities/notification.entity.js';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    notificationRepo = {
      create: jest.fn().mockImplementation((e: Record<string, unknown>) => e),
      save: jest.fn().mockImplementation((e: Record<string, unknown>) =>
        Promise.resolve({ id: 'notif-1', createdAt: new Date(), readAt: null, ...e }),
      ),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
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
});
