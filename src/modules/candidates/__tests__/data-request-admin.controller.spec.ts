import { Test, TestingModule } from '@nestjs/testing';
import { DataRequestAdminController } from '../data-request-admin.controller.js';
import { DataRequestService } from '../data-request.service.js';
import {
  DataRequestStatus,
  DataRequestType,
} from '../entities/data-request.entity.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../../common/guards/staff-mfa.guard.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('DataRequestAdminController', () => {
  let controller: DataRequestAdminController;
  let dataRequestService: { search: jest.Mock; updateStatus: jest.Mock };

  const admin: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@example.com',
    roles: [Role.ADMIN],
  };

  const sample = {
    id: 'req-1',
    userId: 'user-1',
    type: DataRequestType.ERASURE,
    status: DataRequestStatus.PENDING,
    message: null,
    resolutionNote: null,
    handledByUserId: null,
    dueAt: new Date('2026-10-16T00:00:00.000Z'),
    resolvedAt: null,
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    updatedAt: new Date('2026-09-16T00:00:00.000Z'),
  };

  beforeEach(async () => {
    dataRequestService = {
      search: jest.fn().mockResolvedValue({
        items: [sample],
        total: 1,
        page: 1,
        limit: 20,
        pageCount: 1,
      }),
      updateStatus: jest.fn().mockResolvedValue({
        ...sample,
        status: DataRequestStatus.COMPLETED,
        handledByUserId: admin.sub,
        resolvedAt: new Date('2026-09-17T00:00:00.000Z'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataRequestAdminController],
      providers: [
        { provide: DataRequestService, useValue: dataRequestService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(StaffMfaGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DataRequestAdminController);
  });

  it('lists the queue with serialized dates', async () => {
    const result = await controller.list({ page: 1, limit: 20 });
    expect(dataRequestService.search).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.items[0].dueAt).toBe('2026-10-16T00:00:00.000Z');
    // The joined user relation must never leak into the payload.
    expect(result.items[0]).not.toHaveProperty('user');
  });

  it('resolves a request and returns the updated shape', async () => {
    const result = await controller.updateStatus(admin, 'req-1', {
      status: DataRequestStatus.COMPLETED,
      resolutionNote: 'handled',
    });

    expect(dataRequestService.updateStatus).toHaveBeenCalledWith(
      'req-1',
      admin.sub,
      DataRequestStatus.COMPLETED,
      'handled',
    );
    expect(result.status).toBe(DataRequestStatus.COMPLETED);
    expect(result.resolvedAt).toBe('2026-09-17T00:00:00.000Z');
  });
});
