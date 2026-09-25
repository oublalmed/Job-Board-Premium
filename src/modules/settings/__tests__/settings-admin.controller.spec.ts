import { Test, TestingModule } from '@nestjs/testing';
import { SettingsAdminController } from '../settings-admin.controller.js';
import { SettingsService } from '../settings.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { StaffMfaGuard } from '../../../common/guards/staff-mfa.guard.js';
import type { JwtPayload } from '../../../common/interfaces/request-with-user.interface.js';
import { Role } from '../../../common/enums/role.enum.js';

describe('SettingsAdminController', () => {
  let controller: SettingsAdminController;
  let settingsService: { getAll: jest.Mock; set: jest.Mock };
  let auditService: { log: jest.Mock };

  const admin: JwtPayload = {
    sub: 'admin-1',
    email: 'admin@example.com',
    roles: [Role.ADMIN],
  };

  beforeEach(async () => {
    settingsService = {
      getAll: jest.fn().mockResolvedValue([
        {
          key: 'indexation_score_min',
          value: '40',
          description: null,
          valueType: 'number',
          updatedAt: new Date(),
        },
      ]),
      set: jest.fn().mockResolvedValue({
        key: 'indexation_score_min',
        value: '45',
        description: 'min score',
        updatedAt: new Date(),
      }),
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsAdminController],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: AuditService, useValue: auditService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(StaffMfaGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SettingsAdminController);
  });

  it('lists settings', async () => {
    const result = await controller.list();
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('indexation_score_min');
  });

  it('updates a setting and records an audit entry', async () => {
    const result = await controller.update(admin, 'indexation_score_min', {
      value: '45',
      description: 'min score',
    });

    expect(settingsService.set).toHaveBeenCalledWith(
      'indexation_score_min',
      '45',
      'min score',
      undefined,
      'admin-1',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        entityType: 'setting',
        entityId: 'indexation_score_min',
      }),
    );
    expect(result.value).toBe('45');
  });
});
