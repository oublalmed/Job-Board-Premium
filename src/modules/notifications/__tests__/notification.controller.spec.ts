import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from '../notification.controller.js';
import { NotificationService } from '../notification.service.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: Record<string, jest.Mock>;

  const user: JwtPayload = { sub: 'user-1', email: 'a@b.com', roles: [Role.CANDIDATE] };

  beforeEach(async () => {
    notificationService = {
      listForUser: jest.fn().mockResolvedValue([{ id: 'notif-1' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: notificationService }],
    }).compile();

    controller = module.get(NotificationController);
  });

  it("lists the current user's own notifications, scoped by their own sub", async () => {
    const result = await controller.listMine(user);

    expect(notificationService.listForUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'notif-1' }]);
  });
});
