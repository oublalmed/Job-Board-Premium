import { Test, TestingModule } from '@nestjs/testing';
import { GrowthNotificationService } from '../growth-notification.service.js';
import { NotificationService } from '../notification.service.js';
import { NotificationType } from '../entities/notification.entity.js';
import { MAIL_PROVIDER } from '../../../ports/mail.port.js';

describe('GrowthNotificationService', () => {
  let service: GrowthNotificationService;
  let notificationService: Record<string, jest.Mock>;
  let mailProvider: Record<string, jest.Mock>;

  beforeEach(async () => {
    notificationService = {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };
    mailProvider = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrowthNotificationService,
        { provide: NotificationService, useValue: notificationService },
        { provide: MAIL_PROVIDER, useValue: mailProvider },
      ],
    }).compile();

    service = module.get(GrowthNotificationService);
  });

  it('writes the in-app notification and sends the email', async () => {
    await service.notifyCooldownExpired({
      recipientUserId: 'user-1',
      email: 'candidate@example.com',
    });

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-1',
        type: NotificationType.COOLDOWN_EXPIRED,
      }),
      undefined,
    );
    expect(mailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'candidate@example.com', templateId: 'cooldown-expired' }),
    );
  });

  it('still resolves and does not lose the in-app notification when the mail provider fails (best-effort email)', async () => {
    mailProvider.send.mockRejectedValueOnce(new Error('SMTP unavailable'));

    await expect(
      service.notifyCooldownExpired({ recipientUserId: 'user-1', email: 'candidate@example.com' }),
    ).resolves.toBeUndefined();

    expect(notificationService.create).toHaveBeenCalledTimes(1);
  });

  it('propagates a failure to write the in-app notification (not best-effort, unlike email)', async () => {
    notificationService.create.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(
      service.notifyCooldownExpired({ recipientUserId: 'user-1', email: 'candidate@example.com' }),
    ).rejects.toThrow('DB unavailable');

    expect(mailProvider.send).not.toHaveBeenCalled();
  });
});
